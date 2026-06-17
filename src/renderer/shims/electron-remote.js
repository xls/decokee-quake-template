// Renderer shim for @electron/remote, resolved at runtime via nodeIntegration.
// See ./electron.js for why bare ESM specifiers must be re-exported through window.require.
const remote = window.require('@electron/remote')

export const dialog = remote.dialog
export const app = remote.app
export const getCurrentWindow = remote.getCurrentWindow
export const getGlobal = remote.getGlobal
export const Menu = remote.Menu
export const shell = remote.shell
export const clipboard = remote.clipboard

export default remote
