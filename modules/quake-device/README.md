# quake-device

Control library and test CLI for the **DecoKee QUAKE** display over raw HID.

The QUAKE exposes a VIA raw-HID interface (usage `0x61` / usage page `0xFF60`)
that accepts a `0xA3` "short command" family for screen power, brightness, mic,
LED, firmware info, DFU, and a watchdog keep-alive. The firmware blanks the
display if it stops receiving keep-alive pings (~every 15s).

This package implements that protocol with no Electron dependency, so it can be
driven from a plain Node script, the test CLI, or the main process.

## Library

```js
const { QuakeDevice, listDevices } = require('./modules/quake-device');

const dev = new QuakeDevice();        // opens the first attached QUAKE
dev.wake();                            // screen on + full brightness + keep-alive
console.log(await dev.getInfo());      // { deviceName, version }
dev.on('rotate', (dir) => console.log('jog', dir));
dev.on('press', () => console.log('knob pressed'));
```

Key methods: `setScreen(on)`, `setBrightness(v)` / `getBrightness()`,
`setMic(on)` / `getMic()`, `setLed(on)` (WS2812 effect, cmd 0x06),
`setBuzzerTone(tone)` / `beep(tone, ms)` / `playToneSequence([[tone,ms],...])`
(piezo buzzer, cmd 0x02; tone 0 = silent), `getInfo()`,
`sendKey(action, id, code)`, `enterDownloadMode()`, `ping()`,
`startKeepAlive()` / `stopKeepAlive()`, `wake()`, `send(payload, flag)` (raw),
`query(cmdID)`, `close()`.

> Note: control cmd **0x02** is the piezo buzzer (tone); cmd **0x06** is the
> LED effect enable. The host UI calls 0x06 "buzzer", but it makes no sound —
> use `beep()`/`setBuzzerTone()` for audio.

Events: `report`, `state`, `rotate`, `press`, `raw`, `error`.

## CLI

```
node modules/quake-device/cli.js <command> [args] [--serial SN] [--debug]
```

| Command | Description |
|---|---|
| `list` | list attached QUAKE interfaces |
| `info` | read device name + firmware version |
| `screen on\|off` | turn the display on/off |
| `brightness [0-255]` | set brightness, or read it |
| `mic on\|off` | enable/disable mic, or read it |
| `led on\|off` | enable/disable the LED |
| `key <action> <id> <code>` | send a key/action frame |
| `ping` | send one keep-alive ping |
| `wake [seconds]` | screen on + full brightness + keep-alive (holds N s / Ctrl+C) |
| `keepalive [seconds]` | keep-alive only |
| `dfu` | enter the firmware download bootloader |
| `monitor` | print incoming reports (knob, touch, state) |
| `raw <byte>...` | send an arbitrary control payload (flag 1) |
| `rawq <byte>...` | send an arbitrary control payload as a query (flag 2) |

Example — keep the display lit for 30s while watching the jog wheel:

```
node modules/quake-device/cli.js wake 30 --debug
node modules/quake-device/cli.js monitor
```

## Protocol summary

Outgoing control frame (a leading report-id `0x00` is prepended for the HID write):

```
[0xA3, payloadLen+1, flag, ...payload, checksum]      checksum = (flag + sum(payload)) % 0xFF
```

`flag` is `1` for set/action commands and `2` for queries and the keep-alive ping.

Incoming report (report-id already stripped by node-hid):

```
[0xA3, len, opCode, cmdID, ...subData, checksum]
```

`opCode 0x03` = jog wheel (cmdID 1 rotate, 2 press). `opCode 0x55` = state report,
where `cmdID` selects the value: `46` device info (`subData[1..3]` = firmware
version), `5` brightness, `3` mic, `239` keep-alive pong.
