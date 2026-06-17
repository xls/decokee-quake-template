// Launches `electron-vite dev` with ELECTRON_RUN_AS_NODE cleared.
//
// Some shells / VS Code sessions inherit ELECTRON_RUN_AS_NODE=1 (often left over from
// native-module rebuilds). When it is set, the Electron binary runs as plain Node, so
// require('electron') returns a path string and the app cannot start. Setting it to ""
// is not enough — Electron treats any present value as "run as node" — so we delete it
// outright, then spawn electron-vite with the cleaned environment.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

delete process.env.ELECTRON_RUN_AS_NODE

// Silence Vite's "CJS build of Vite's Node API is deprecated" notice (electron-vite
// loads Vite via CJS internally; not something we control).
process.env.VITE_CJS_IGNORE_WARNING = 'true'

// Run electron-vite's JS entry directly with the current Node binary — no shell,
// so there's no shell-arg-escaping deprecation warning and it works regardless of
// how this script is invoked.
const bin = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'electron-vite', 'bin', 'electron-vite.js')

const child = spawn(process.execPath, [bin, 'dev'], {
    stdio: 'inherit',
    env: process.env,
})

child.on('exit', code => process.exit(code ?? 0))
