// Renderer shim for Electron's built-in `electron` module.
//
// Vite emits ESM, and the renderer loads it via <script type="module">. A static
// `import { ipcRenderer } from 'electron'` would survive as a bare specifier that the
// browser ESM loader cannot resolve. With nodeIntegration enabled we can pull the real
// module at runtime via window.require and re-export the named bindings the app uses.
//
// The renderer bundle also transitively pulls in some main-process modules (e.g. the AI
// subsystem, imported only for constants). Those import main-only symbols such as
// `ipcMain`/`BrowserWindow`. We re-export the full union of names so Rollup can resolve
// them; in the renderer they evaluate to `undefined`, which is harmless because that
// main-only code is never executed here.
const electron = window.require('electron')

// Available in the renderer process.
export const ipcRenderer = electron.ipcRenderer
export const shell = electron.shell
export const clipboard = electron.clipboard
export const nativeImage = electron.nativeImage
export const webFrame = electron.webFrame
export const contextBridge = electron.contextBridge
export const desktopCapturer = electron.desktopCapturer
export const crashReporter = electron.crashReporter

// Main-only symbols: undefined in the renderer, present only so transitively-bundled
// main modules resolve their imports. Never invoked from renderer code.
export const ipcMain = electron.ipcMain
export const app = electron.app
export const BrowserWindow = electron.BrowserWindow
export const Menu = electron.Menu
export const Tray = electron.Tray
export const dialog = electron.dialog
export const globalShortcut = electron.globalShortcut
export const screen = electron.screen
export const webContents = electron.webContents

export default electron
