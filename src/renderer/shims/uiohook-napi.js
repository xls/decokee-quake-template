// Renderer shim for uiohook-napi (a native addon).
//
// The renderer genuinely uses this module at runtime (global keyboard capture for the
// hotkey settings UI), so it must be the real native addon, not a stub. If Vite bundles
// it for the renderer, its dependency node-gyp-build calls os.arch() against Vite's browser
// `os` stub and throws "os.arch is not a function", blanking the renderer.
//
// Resolving through window.require loads the real module via nodeIntegration (real Node
// `os`/`fs`/`path`), bypassing Vite's bundling and browser stubs. Same approach as the
// electron / @electron/remote shims in this folder.
const uiohook = window.require('uiohook-napi')

export const uIOhook = uiohook.uIOhook
export const UiohookKey = uiohook.UiohookKey
export const EventType = uiohook.EventType

export default uiohook
