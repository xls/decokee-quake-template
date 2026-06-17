/*
 * quake-device — control library for the DecoKee QUAKE display over raw HID.
 *
 * Usage:
 *   import { QuakeDevice, listDevices } from 'quake-device';
 *   const dev = new QuakeDevice();   // opens the first attached QUAKE
 *   dev.wake();                       // screen on + brightness + keep-alive
 *   console.log(await dev.getInfo()); // { deviceName, version }
 */
export * from './protocol.js';
export * from './device.js';
export * from './touch.js';
