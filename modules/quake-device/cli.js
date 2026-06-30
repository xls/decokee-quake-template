#!/usr/bin/env node
/*
 * quake — test CLI for the DecoKee QUAKE display.
 *
 *   node modules/quake-device/cli.js <command> [args] [--serial SN] [--debug]
 *
 * Commands:
 *   list                       list attached QUAKE interfaces
 *   info                       read device name + firmware version
 *   screen on|off              turn the display on/off
 *   brightness [0-255]         set brightness, or read it when no value given
 *   mic on|off                 enable/disable the mic, or read it
 *   led on|off                 enable/disable the WS2812 LED effect (cmd 0x06)
 *   tone <value> [ms]          drive the piezo buzzer (cmd 0x02); 0 = silent.
 *                              with ms, beep for that long then go silent
 *   buzzer|beep [tone] [ms]    quick beep (default tone 200 for 100ms)
 *   key <action> <id> <code>   send a key/action frame
 *   ping                       send one keep-alive ping
 *   wake [seconds]             screen on + full brightness + keep-alive
 *                              (holds for N seconds, or until Ctrl+C)
 *   keepalive [seconds]        keep-alive only (no screen/brightness change)
 *   dfu                        enter the firmware download (DFU) bootloader
 *   monitor                    print incoming reports (knob, touch, state)
 *   raw <byte>...              send an arbitrary control payload (flag 1)
 *   rawq <byte>...             send an arbitrary control payload as a query (flag 2)
 *
 * Flags: --serial <SN> pick a device; --debug log every frame.
 */
import { QuakeDevice, listDevices } from './index.js';

const HELP = `quake — test CLI for the DecoKee QUAKE display.

  node modules/quake-device/cli.js <command> [args] [--serial SN] [--debug]

Commands:
  list                       list attached QUAKE interfaces
  info                       read device name + firmware version
  screen on|off              turn the display on/off
  brightness [0-255]         set brightness, or read it when no value given
  mic on|off                 enable/disable the mic, or read it
  led on|off                 enable/disable the WS2812 LED effect (cmd 0x06)
  tone <value> [ms]          drive the piezo buzzer (cmd 0x02); 0 = silent.
                             with ms, beep for that long then go silent
  buzzer|beep [tone] [ms]    quick beep (default tone 200 for 100ms)
  key <action> <id> <code>   send a key/action frame
  ping                       send one keep-alive ping
  wake [seconds]             screen on + full brightness + keep-alive
                             (holds for N seconds, or until Ctrl+C)
  keepalive [seconds]        keep-alive only (no screen/brightness change)
  dfu                        enter the firmware download (DFU) bootloader
  monitor                    print incoming reports (knob, touch, state)
  raw <byte>...              send an arbitrary control payload (flag 1)
  rawq <byte>...             send an arbitrary control payload as a query (flag 2)

Flags: --serial <SN> pick a device; --debug log every frame.`;

function parseArgs(argv) {
    const positional = [];
    const opts = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--debug') opts.debug = true;
        else if (a === '--serial') opts.serialNumber = argv[++i];
        else positional.push(a);
    }
    return { positional, opts };
}

function open(opts) {
    const dev = new QuakeDevice({ serialNumber: opts.serialNumber, debug: opts.debug });
    if (dev.info) {
        console.log(`Opened QUAKE: ${dev.info.product} serial=${dev.info.serialNumber} path=${dev.info.path}`);
    }
    return dev;
}

function hold(seconds, onTick) {
    return new Promise((resolve) => {
        const stop = () => {
            clearInterval(timer);
            clearTimeout(deadline);
            resolve();
        };
        process.on('SIGINT', stop);
        const timer = onTick ? setInterval(onTick, 1000) : null;
        const deadline = seconds ? setTimeout(stop, seconds * 1000) : null;
        if (!seconds) console.log('Holding... press Ctrl+C to stop.');
    });
}

const onOff = (v) => {
    if (v === 'on' || v === '1' || v === 'true') return true;
    if (v === 'off' || v === '0' || v === 'false') return false;
    throw new Error(`expected on|off, got "${v}"`);
};

async function main() {
    const { positional, opts } = parseArgs(process.argv.slice(2));
    const cmd = positional[0];
    const args = positional.slice(1);

    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
        console.log(HELP);
        return;
    }

    if (cmd === 'list') {
        const devices = listDevices();
        if (!devices.length) {
            console.log('No QUAKE interfaces found.');
            return;
        }
        for (const d of devices) {
            console.log(`- product=${d.product} serial=${d.serialNumber} vid=${d.vendorId} pid=${d.productId} path=${d.path}`);
        }
        return;
    }

    const dev = open(opts);
    try {
        switch (cmd) {
            case 'info': {
                console.log(await dev.getInfo());
                break;
            }
            case 'screen': {
                dev.setScreen(onOff(args[0]));
                console.log(`screen ${args[0]}`);
                break;
            }
            case 'brightness': {
                if (args[0] === undefined) {
                    console.log('brightness:', await dev.getBrightness());
                } else {
                    dev.setBrightness(Number(args[0]));
                    console.log(`brightness set to ${Number(args[0])}`);
                }
                break;
            }
            case 'mic': {
                if (args[0] === undefined) {
                    console.log('mic:', (await dev.getMic()) ? 'on' : 'off');
                } else {
                    dev.setMic(onOff(args[0]));
                    console.log(`mic ${args[0]}`);
                }
                break;
            }
            case 'led': {
                dev.setLed(onOff(args[0]));
                console.log(`led ${args[0]}`);
                break;
            }
            case 'tone': {
                // tone <value> [ms] — drive the buzzer at <value>; if ms given,
                // beep for that long then go silent, else leave it on.
                const value = Number(args[0]);
                if (args[1] !== undefined) {
                    await dev.beep(value, Number(args[1]));
                    console.log(`beeped tone=${value} for ${Number(args[1])}ms`);
                } else {
                    dev.setBuzzerTone(value);
                    console.log(`tone set to ${value} (use "tone 0" to silence)`);
                }
                break;
            }
            case 'buzzer':
            case 'beep': {
                // beep [tone] [ms] — quick beep (defaults 200 for 100ms).
                const tone = args[0] !== undefined ? Number(args[0]) : 200;
                const ms = args[1] !== undefined ? Number(args[1]) : 100;
                await dev.beep(tone, ms);
                console.log(`beep tone=${tone} ms=${ms}`);
                break;
            }
            case 'touch': {
                console.log('Touch monitor... press Ctrl+C to stop.');
                dev.on('touch', (pts) => console.log('touch', JSON.stringify(pts)));
                await hold(0);
                break;
            }
            case 'key': {
                const [action, id, code] = args.map(Number);
                dev.sendKey(action, id, code);
                console.log(`key action=${action} id=${id} code=${code}`);
                break;
            }
            case 'ping': {
                dev.ping();
                console.log('ping sent');
                break;
            }
            case 'wake': {
                const seconds = args[0] ? Number(args[0]) : 0;
                dev.wake();
                console.log('wake sent (screen on + brightness 255 + keep-alive)');
                await hold(seconds, () => dev.ping());
                break;
            }
            case 'keepalive': {
                const seconds = args[0] ? Number(args[0]) : 0;
                dev.startKeepAlive();
                console.log('keep-alive started');
                await hold(seconds);
                break;
            }
            case 'dfu': {
                dev.enterDownloadMode();
                console.log('download-mode (DFU) command sent');
                break;
            }
            case 'monitor': {
                console.log('Monitoring reports... press Ctrl+C to stop.');
                dev.on('report', (r) => console.log('report', r));
                dev.on('rotate', (d) => console.log('rotate', d > 0 ? 'CW' : 'CCW'));
                dev.on('press', (v) => console.log('press', v));
                dev.on('state', (s) => console.log('state', s));
                dev.on('raw', (b) => console.log('raw', b));
                await hold(0);
                break;
            }
            case 'raw':
            case 'rawq': {
                const payload = args.map((x) => Number(x.startsWith('0x') ? parseInt(x, 16) : x));
                const flag = cmd === 'rawq' ? 2 : 1;
                dev.send(payload, flag);
                console.log(`sent payload [${payload.join(',')}] flag=${flag}`);
                break;
            }
            default:
                console.error(`Unknown command: ${cmd} (try "help")`);
                process.exitCode = 1;
        }
        // Give async writes/responses a moment to flush before closing.
        await new Promise((r) => setTimeout(r, 50));
    } finally {
        dev.close();
    }
}

main().catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
});
