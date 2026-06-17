import {setI18nLanguage} from "@/plugins/i18n";
import {globalShortcut, app} from "electron";

const Store = require('electron-store')

class StoreManager {
    constructor() {
        this.store = new Store();

        if (!this.store.has('system.openAsHidden')) {
            this.store.set('system.openAsHidden', false)
        }
        const that = this;
        app.on('ready', () => {
            const systemLocale = app.getLocale();
            const userConfigLocale = that.store.get('system.locale');
            console.log('StoreManager: constructor: systemLocale: ', systemLocale, ' userConfigLocale: ', userConfigLocale);
            if (!userConfigLocale) {
                if (systemLocale === 'zh-CN') {
                    that.store.set('system.locale', 'zh')
                } else {
                    that.store.set('system.locale', 'en')
                }
            }

            const locale = that.storeGet('system.locale');
            setI18nLanguage(locale);
        });
        this.store.delete('currentSelectedDevice');
        this.store.delete('mainscreen.deviceName');
    }

    hasValue(key) {
        return this.store.has(key)
    }

    storeSet(key, value) {
        console.log('StoreSet for key: ', key, ' Value: ', value);
        if (key === 'system.locale') {
            setI18nLanguage(value);

            try {
                if (!global.appManager || !global.appManager.windowManager || !global.appManager.windowManager.mainWindow
                    || !global.appManager.windowManager.mainWindow.win) {
                    return;
                }
                global.appManager.windowManager.mainWindow.win.webContents.send('LocaleChanged', value);
            } catch (err) {
                console.log(err)
            }
        }

        this.store.set(key, value);
    }

    storeSetObject(object) {
        this.store.set(object)
    }

    storeGet(key) {
        return this.store.get(key)
    }

    storeGet(key, defaultValue) {
        return this.store.get(key, defaultValue)
    }

    storeDelete(key) {
        this.store.delete(key)
    }
}

export default StoreManager
