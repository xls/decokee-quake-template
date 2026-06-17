'use strict'

import { shell, clipboard, app } from 'electron'
import { join } from 'path'
import AppManager from './managers/app'

// Silence Chromium's native stderr noise (DevTools "Autofill.* wasn't found"
// notices, GPU/network teardown messages, etc.) by only surfacing FATAL logs.
// Our own logging goes through electron-log and is unaffected; real renderer JS
// errors still show in DevTools.
app.commandLine.appendSwitch('log-level', '3')

// Dev-only: expose the Chrome DevTools Protocol so the renderer console/state can be
// inspected over http://localhost:9222 (for debugging). No effect in packaged builds.
if (process.env.ELECTRON_RENDERER_URL) {
    app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

const remote = require('@electron/remote/main')
remote.initialize()

const log = require('electron-log')
console.log = log.log

const fs = require('fs')
const path = require('path')

const { globalShortcut } = require('electron')

const { setTimeout, setInterval, clearTimeout, clearInterval } = require('timers')

const installPath = app.getPath('exe')
const userDataPath = app.getPath('userData')

global.setTimeout = setTimeout
global.setInterval = setInterval
global.clearTimeout = clearTimeout
global.clearInterval = clearInterval
global.log = log.log
global.fs = fs
global.path = path
global.platform = process.platform
global.arch = process.arch
global.shell = shell
global.clipboard = clipboard
global.globalShortcut = globalShortcut
global.installPath = installPath
global.userDataPath = userDataPath

// Replaces the __static global that vue-cli-plugin-electron-builder provided.
// Points to the public/ directory: ../../public from out/main/
global.__static = join(__dirname, '../../public')

const shelljs = require('shelljs')
const extractPath = path.resolve(installPath, '..', 'resources', 'app')
console.log('installPath: ', installPath, ' ExtraPath: ', extractPath)

let needFullLoad = true

if (
    fs.existsSync(extractPath + '-new') &&
    moveFiles(extractPath, extractPath + '-bck') &&
    moveFiles(extractPath + '-new', extractPath)
) {
    shelljs.rm('-rf', extractPath + '-bck')

    if (fs.existsSync(extractPath + '.zip')) {
        shelljs.rm('-rf', extractPath + '.zip')
    }

    app.relaunch()
    setTimeout(() => {
        process.kill(process.pid, 'SIGINT')
    }, 300)
    needFullLoad = false
} else if (fs.existsSync(extractPath + '-bck')) {
    moveFiles(extractPath + '-bck', extractPath)

    if (fs.existsSync(extractPath + '.zip')) {
        shelljs.rm('-rf', extractPath + '.zip')
    }

    app.relaunch()
    setTimeout(() => {
        process.kill(process.pid, 'SIGINT')
    }, 300)
    needFullLoad = false
}

const appManager = new AppManager(needFullLoad)

global.appManager = appManager

function moveFiles(srcFolderPath, destFolderPath) {
    try {
        if (!fs.existsSync(srcFolderPath)) {
            console.log('SRC folder not exist. Ignore move')
            return false
        }
        shelljs.mv(srcFolderPath, destFolderPath)
        console.log('Folder moved from ' + srcFolderPath + ' To ' + destFolderPath + ' successfully!')
        return true
    } catch (e) {
        console.error(e)
    }
    return false
}
