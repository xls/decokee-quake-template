/*
 * QuakeDevice — a high-level handle to a DecoKee QUAKE display over raw HID.
 *
 * Wraps node-hid with the 0xA3 control protocol (see protocol.js): screen,
 * brightness, mic, LED, firmware/info, DFU, the watchdog keep-alive, and raw
 * access for experimentation. Queries are correlated to their 0x55 responses
 * so callers get a promise back.
 *
 * No Electron dependency — usable from a plain Node CLI or from the main process.
 */
import { EventEmitter } from 'events';
import HID from 'node-hid';
import { FLAG, CTL, RESP, toReport, parseReport, decodeState, decodeTouch } from './protocol.js';
import { QuakeTouchDevice } from './touch.js';

// The QUAKE control endpoint is the VIA raw-HID interface.
export const QUAKE_USAGE = 0x61;
export const QUAKE_USAGE_PAGE = 0xff60;
export const QUAKE_PRODUCT_NAME = 'QUAKE';

// The firmware blanks the display if it stops receiving keep-alive pings; the
// product sends one every 15s.
export const KEEP_ALIVE_MS = 15000;
const DEFAULT_QUERY_TIMEOUT_MS = 500;

/** List all attached QUAKE control interfaces. */
export function listDevices() {
    return HID.devices().filter(
        (d) => d.usage === QUAKE_USAGE && d.usagePage === QUAKE_USAGE_PAGE
    );
}

/** Find the first QUAKE control interface (optionally filtered by serial). */
export function findDevice(serialNumber) {
    const devices = listDevices();
    if (serialNumber) return devices.find((d) => d.serialNumber === serialNumber);
    // Prefer an interface that actually reports the QUAKE product name.
    return devices.find((d) => d.product === QUAKE_PRODUCT_NAME) || devices[0];
}

export class QuakeDevice extends EventEmitter {
    /**
     * @param {object} [opts]
     * @param {string} [opts.path] node-hid device path to open directly.
     * @param {string} [opts.serialNumber] open the QUAKE with this serial.
     * @param {boolean} [opts.debug] log every frame written/received.
     */
    constructor(opts = {}) {
        super();
        this.debug = !!opts.debug;

        let path = opts.path;
        let info = null;
        if (!path) {
            info = findDevice(opts.serialNumber);
            if (!info) throw new Error('No QUAKE device found');
            path = info.path;
        }
        this.info = info;
        this.path = path;
        this.device = new HID.HID(path);
        this._keepAliveTimer = null;
        this._waiters = [];
        // Last-known hardware state, updated from incoming 0x55 reports. The
        // buzzer has no read-back; the device powers up with it enabled.
        this.state = { version: null, deviceName: null, brightness: null, mic: null, buzzer: true };

        this.device.on('data', (data) => this._onData(data));
        this.device.on('error', (err) => {
            // Re-emit only if someone is listening; a bare 'error' emit with no
            // listener throws (EventEmitter semantics) and would tear down the
            // read loop / keep-alive.
            if (this.listenerCount('error') > 0) this.emit('error', err);
            else this._log('device error', err && err.message);
        });

        // Touch input arrives on a SEPARATE HID device; open it and re-emit its
        // events here so callers get touch from the one QuakeDevice handle.
        this.touch = new QuakeTouchDevice({ debug: this.debug });
        this.touch.on('touch', (points) => this.emit('touch', points));
        this.touch.on('raw', (bytes) => this.emit('touchRaw', bytes));
        if (opts.touch !== false) this.touch.bind();
    }

    _log(...args) {
        if (this.debug) console.log('[quake]', ...args);
    }

    _onData(data) {
        const report = parseReport(data);
        if (!report) {
            this.emit('raw', Array.from(data));
            return;
        }
        this._log('recv', report);
        this.emit('report', report);

        if (report.opCode === RESP.KNOB) {
            // Jog wheel: cmdID 1 = rotate, 2 = press.
            if (report.cmdID === 1) {
                this.emit('rotate', report.subData[0] === 1 ? 1 : -1);
            } else if (report.cmdID === 2) {
                this.emit('press', report.subData[0]);
            }
        }

        const touch = decodeTouch(report);
        if (touch) this.emit('touch', touch);

        const state = decodeState(report);
        if (state) {
            // Keep the cached hardware state in sync for getState().
            if (state.kind === 'info') {
                this.state.version = state.version;
                this.state.deviceName = state.deviceName;
            } else if (state.kind === 'brightness') {
                this.state.brightness = state.value;
            } else if (state.kind === 'mic') {
                this.state.mic = state.enabled;
            }
            this.emit('state', state);
        }

        // Resolve any pending query waiting on this report.
        for (let i = this._waiters.length - 1; i >= 0; i--) {
            if (this._waiters[i].match(report)) {
                const w = this._waiters.splice(i, 1)[0];
                clearTimeout(w.timer);
                w.resolve(report);
            }
        }
    }

    /** Write a control frame: payload bytes + flag (1=set, 2=query). */
    send(payload, flag = FLAG.SET) {
        const report = toReport(payload, flag);
        this._log('send', report);
        return this.device.write(report);
    }

    /**
     * Send a query (flag 2) and resolve with the matching 0x55 response.
     * @param {number} cmdID payload command id (also the response cmdID).
     */
    query(cmdID, { timeout = DEFAULT_QUERY_TIMEOUT_MS } = {}) {
        const promise = new Promise((resolve, reject) => {
            const waiter = {
                match: (r) => r.opCode === RESP.STATE && r.cmdID === cmdID,
                resolve,
                timer: setTimeout(() => {
                    const idx = this._waiters.indexOf(waiter);
                    if (idx !== -1) this._waiters.splice(idx, 1);
                    reject(new Error(`QUAKE query 0x${cmdID.toString(16)} timed out`));
                }, timeout),
            };
            this._waiters.push(waiter);
        });
        this.send([cmdID], FLAG.QUERY);
        return promise;
    }

    // --- Screen ------------------------------------------------------------
    setScreen(on) {
        return this.send([CTL.SCREEN, on ? 1 : 0], FLAG.SET);
    }

    // --- Brightness --------------------------------------------------------
    setBrightness(value) {
        const v = Math.max(0, Math.min(255, value | 0));
        this.state.brightness = v;
        return this.send([CTL.BRIGHTNESS, v], FLAG.SET);
    }

    async getBrightness() {
        const r = await this.query(CTL.BRIGHTNESS);
        return r.subData[0];
    }

    // --- Mic ---------------------------------------------------------------
    setMic(on) {
        this.state.mic = !!on;
        return this.send([CTL.MIC, on ? 1 : 0], FLAG.SET);
    }

    async getMic() {
        const r = await this.query(CTL.MIC);
        return r.subData[0] === 1;
    }

    // --- Buzzer ------------------------------------------------------------
    setBuzzer(enabled) {
        // Product sends enabled?0:1 for this command.
        this.state.buzzer = !!enabled;
        return this.send([CTL.BUZZER, enabled ? 0 : 1], FLAG.SET);
    }

    /** @deprecated alias for setBuzzer (0x06). */
    setLed(enabled) {
        return this.setBuzzer(enabled);
    }

    // --- Firmware / info ---------------------------------------------------
    async getInfo() {
        const r = await this.query(CTL.INFO);
        return {
            deviceName: r.subData[0],
            version: `${r.subData[1]}.${r.subData[2]}.${r.subData[3]}`,
        };
    }

    /** Last-known cached hardware state (populated from incoming reports). */
    getState() {
        return { ...this.state };
    }

    /** Query firmware/brightness/mic and update the cached state. */
    async refreshState() {
        try {
            const info = await this.getInfo();
            this.state.version = info.version;
            this.state.deviceName = info.deviceName;
        } catch (e) {
            // leave previous value
        }
        try {
            this.state.brightness = await this.getBrightness();
        } catch (e) {
            // leave previous value
        }
        try {
            this.state.mic = await this.getMic();
        } catch (e) {
            // leave previous value
        }
        return this.getState();
    }

    // --- Keys --------------------------------------------------------------
    sendKey(action, identifier, keyCode) {
        return this.send([CTL.KEY, action, identifier, keyCode], FLAG.SET);
    }

    // --- DFU ---------------------------------------------------------------
    enterDownloadMode() {
        return this.send([CTL.DFU, 3], FLAG.SET);
    }

    // --- Keep-alive (watchdog) --------------------------------------------
    ping() {
        return this.send([CTL.KEEP_ALIVE], FLAG.QUERY);
    }

    startKeepAlive(intervalMs = KEEP_ALIVE_MS) {
        this.stopKeepAlive();
        this.ping();
        this._keepAliveTimer = setInterval(() => {
            // A throw here (e.g. a transient write error) must not kill the
            // interval, or the watchdog starves and the panel blanks.
            try {
                this.ping();
            } catch (err) {
                this._log('keep-alive ping failed', err && err.message);
            }
        }, intervalMs);
        // Don't let the keep-alive timer keep the process alive on its own.
        if (this._keepAliveTimer.unref) this._keepAliveTimer.unref();
        return this;
    }

    stopKeepAlive() {
        if (this._keepAliveTimer) {
            clearInterval(this._keepAliveTimer);
            this._keepAliveTimer = null;
        }
    }

    /** Send the wake sequence: screen on, full brightness, start keep-alive. */
    wake({ brightness = 255, keepAlive = true } = {}) {
        this.setScreen(true);
        this.setBrightness(brightness);
        if (keepAlive) this.startKeepAlive();
        return this;
    }

    close() {
        this.stopKeepAlive();
        for (const w of this._waiters) clearTimeout(w.timer);
        this._waiters = [];
        if (this.touch) {
            this.touch.close();
            this.touch = null;
        }
        try {
            this.device.close();
        } catch (e) {
            // ignore
        }
        this.device = null;
    }
}
