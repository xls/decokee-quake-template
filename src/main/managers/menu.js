import { Menu } from 'electron';
import { i18nRender } from '@/plugins/i18n';

class MenuManager {
    constructor(appManager) {
        this.appManager = appManager;
        this.windowManager = appManager.windowManager;
    }

    AppTrayMenu() {
        const that = this;
        const template = [
            {
                key: '1',
                label: i18nRender('trayMenu.resume'),
                click: () => {
                    if (!that.windowManager.mainWindow.win) {
                        that.windowManager.mainWindow.createWindow();
                    }
                    that.windowManager.mainWindow.win.show();
                    that.windowManager.mainWindow.win.moveTop();
                },
            },
            {
                key: '2',
                label: i18nRender('trayMenu.exit'),
                click: () => {
                    that.appManager.quitApp();
                },
            },
        ];

        return Menu.buildFromTemplate(template);
    }
}

export default MenuManager;
