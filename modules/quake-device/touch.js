/*
 * QuakeTouchDevice — reads the QUAKE panel's touch input.
 *
 * The touch panel is a SEPARATE USB HID device (vendor "hotlotus", not the
 * QUAKE's own VID). Its vendor-specific collection emits raw 0xA3 reports
 * (cmdID 26) with multi-touch coordinates — there is no enable command, the
 * device just needs to be opened and read. Matches the released DK-Suite
 * QuakeTouchEventManager, including rebinding when the read drops.
 */
import { EventEmitter } from 'events';
import HID from 'node-hid';
import { TOUCH_HID_DEVICE, decodeTouchRaw } from './protocol.js';

const REBIND_DELAY_MS = 2000;

/** Find the QUAKE touch HID interface, if connected. */
export function findTouchDevice() {
    return HID.devices().find((d) =>
        TOUCH_HID_DEVICE.some(
            (t) => t[0] === d.vendorId && t[1] === d.productId && t[2] === d.usage && t[3] === d.usagePage
        )
    );
}

export class QuakeTouchDevice extends EventEmitter {
    constructor({ debug = false } = {}) {
        super();
        this.debug = debug;
        this.device = null;
        this.info = null;
        this._rebindTimer = null;
        this._closed = false;
    }

    _log(...args) {
        if (this.debug) console.log('[quake-touch]', ...args);
    }

    /** Open the touch device and start emitting 'touch' events. */
    bind() {
        if (this._closed) return false;
        const info = findTouchDevice();
        if (!info) {
            this._log('no touch device found');
            return false;
        }
        try {
            this.device = new HID.HID(info.path);
            this.info = info;
            this.device.on('data', (data) => {
                const points = decodeTouchRaw(data);
                if (points) this.emit('touch', points);
                else this.emit('raw', Array.from(data));
            });
            this.device.on('error', (err) => {
                this._log('error', err && err.message);
                this._cleanup();
                this._scheduleRebind();
            });
            this._log('bound', info.path);
            this.emit('bound', info);
            return true;
        } catch (e) {
            this._log('bind failed', e.message);
            this._scheduleRebind();
            return false;
        }
    }

    _scheduleRebind() {
        if (this._closed) return;
        clearTimeout(this._rebindTimer);
        this._rebindTimer = setTimeout(() => this.bind(), REBIND_DELAY_MS);
        if (this._rebindTimer.unref) this._rebindTimer.unref();
    }

    _cleanup() {
        if (!this.device) return;
        try {
            this.device.removeAllListeners();
            this.device.close();
        } catch (e) {
            // ignore
        }
        this.device = null;
    }

    close() {
        this._closed = true;
        clearTimeout(this._rebindTimer);
        this._cleanup();
    }
}
