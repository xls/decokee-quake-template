/*
 * QUAKE raw-HID protocol (DecoKee QUAKE display).
 *
 * Pure functions, no I/O — framing and parsing for the 0xA3 "short command"
 * family used over the device's VIA raw-HID interface (usage 0x61 / usagePage
 * 0xFF60). Sequences are taken from the shipping DK-Suite product.
 *
 * Outgoing frame:
 *   [0xA3, payloadLen+1, flag, ...payload, checksum]
 *   checksum = (flag + sum(payload)) % 0xFF
 * The HID report prepends a leading report-id byte (0x00):
 *   [0x00, 0xA3, payloadLen+1, flag, ...payload, checksum]
 *
 * The flag byte is 1 for "set"/action commands and 2 for queries and the
 * keep-alive ping.
 *
 * Incoming report (report-id already stripped by node-hid):
 *   [0xA3, len, opCode, cmdID, ...subData, checksum]
 *   checksum = sum(opCode, cmdID, ...subData) % 0xFF
 */

// Command family.
export const CMD_CONTROL = 0xa3;

// Frame flag (third byte of an outgoing control frame).
export const FLAG = {
    SET: 1, // set / action — fire and forget
    QUERY: 2, // query (expects a 0x55 state response) and keep-alive ping
};

// Control payload command ids (first byte of the payload array).
export const CTL = {
    BUZZER: 2, // [2, tone] piezo buzzer tone (0 = silent); the product's
    //            _writeBuzzer/_playSequence drive this. (Was mislabeled "SUB2".)
    MIC: 3, // [3, on?1:0] set; [3] query
    SCREEN: 4, // [4, on?1:0]
    BRIGHTNESS: 5, // [5, 0..255] set; [5] query
    LED: 6, // [6, mode] WS2812 effect enable (0 = off, 1/2/3 = on). The host
    //          calls this "buzzer" but it does NOT make sound. (Was BUZZER:6.)
    KEY: 16, // [16, action, identifier, keyCode]
    INFO: 46, // [46] query -> device name + firmware version
    DFU: 47, // [47, 3] enter atmel-dfu bootloader
    KEEP_ALIVE: 239, // [239] watchdog ping (flag 2)
};

// opCode of an incoming control report (third byte).
export const RESP = {
    KNOB: 3, // jog wheel: cmdID 1 = rotate (subData[0] = direction), 2 = press
    STATE: 0x55, // state report: cmdID identifies which value (see CTL)
};

// cmdID of an incoming touch report. The panel does NOT use the Windows touch
// API — it sends a custom 0xA3 report whose cmdID is 26 (0x1A), carrying a count
// byte followed by 5 bytes per point: [action, yLo, yHi, xLo, xHi].
export const TOUCH_CMD_ID = 26;

// The touch panel enumerates as a SEPARATE USB HID device (not the QUAKE's own
// VID). Match it by [vendorId, productId, usage, usagePage]; the vendor-specific
// collection (usage 0x71 / usagePage 0xFF73) carries the raw 0xA3 touch reports.
export const TOUCH_HID_DEVICE = [[1810, 16, 113, 65395]];

/** Build a 0xA3 control frame body (without the leading report-id byte). */
export function wrapControl(payload, flag) {
    const body = [CMD_CONTROL, payload.length + 1, flag];
    let checksum = flag;
    for (const b of payload) {
        body.push(b & 0xff);
        checksum += b;
    }
    body.push(checksum % 0xff);
    return body;
}

/** Wrap a control frame into a writable HID report (prepends report-id 0x00). */
export function toReport(payload, flag) {
    return [0x00, ...wrapControl(payload, flag)];
}

/**
 * Parse an incoming control report. Accepts a Buffer or byte array, with or
 * without a leading report-id byte. Returns { opCode, cmdID, subData } or null
 * if it is not a valid 0xA3 frame.
 */
export function parseReport(input) {
    const bytes = Array.from(input);
    // Some platforms prepend the report-id byte; skip a leading 0x00.
    const start = bytes[0] === CMD_CONTROL ? 0 : bytes[1] === CMD_CONTROL ? 1 : -1;
    if (start === -1) return null;

    const e = bytes.slice(start);
    const len = e[1];
    if (len === undefined || e.length < 2 + len + 1) return null;

    let sum = 0;
    for (let i = 0; i < len; i++) sum += e[2 + i];
    if (sum % 0xff !== e[2 + len]) return null;

    return {
        opCode: e[2],
        cmdID: e[3],
        subData: e.slice(4, 4 + len - 2),
    };
}

/**
 * Decode a touch report (cmdID 26) into an array of { action, x, y } points,
 * or null if it is not a touch report. Coordinates are in the panel's native
 * pixel space.
 */
export function decodeTouch(report) {
    if (!report || report.cmdID !== TOUCH_CMD_ID) return null;
    const sub = report.subData;
    const count = sub[0] || 0;
    const points = [];
    for (let n = 0; n < count; n++) {
        const b = 1 + 5 * n;
        points.push({
            action: sub[b],
            x: (sub[b + 4] << 8) | sub[b + 3],
            y: (sub[b + 2] << 8) | sub[b + 1],
        });
    }
    return points;
}

/**
 * Decode a raw touch report straight from the touch device's bytes (with or
 * without a leading report-id). Unlike control reports these are not checksum-
 * validated; the product only checks bytes[0]===0xA3 && bytes[3]===26. Returns
 * an array of { action, x, y } points, or null.
 */
export function decodeTouchRaw(input) {
    const e = Array.from(input);
    const start = e[0] === CMD_CONTROL ? 0 : e[1] === CMD_CONTROL ? 1 : -1;
    if (start === -1) return null;

    const a = e.slice(start);
    if (a[3] !== TOUCH_CMD_ID) return null;

    const count = a[4] || 0;
    const o = 5;
    const points = [];
    for (let n = 0; n < count; n++) {
        const t = 5 * n;
        points.push({
            action: a[o + t],
            x: (a[o + t + 4] << 8) | a[o + t + 3],
            y: (a[o + t + 2] << 8) | a[o + t + 1],
        });
    }
    return points;
}

/** Decode a STATE (0x55) report into a named hardware value, or null. */
export function decodeState(report) {
    if (!report || report.opCode !== RESP.STATE) return null;
    const { cmdID, subData } = report;
    switch (cmdID) {
        case CTL.INFO:
            return {
                kind: 'info',
                deviceName: subData[0],
                version: `${subData[1]}.${subData[2]}.${subData[3]}`,
            };
        case CTL.BRIGHTNESS:
            return { kind: 'brightness', value: subData[0] };
        case CTL.MIC:
            return { kind: 'mic', enabled: subData[0] === 1 };
        case CTL.KEEP_ALIVE:
            return { kind: 'pong' };
        case 0:
            // change-result: 0x90 (144) signals success.
            return { kind: 'result', success: subData[0] === 0x90 };
        default:
            return { kind: 'unknown', cmdID, subData };
    }
}
