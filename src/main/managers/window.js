import MainWindow from '../windows/mainWindow'
import SettingWindow from "@/main/windows/SettingWindow";
import IconSelectWindow from "@/main/windows/IconSelectWindow";

class WindowManager {
  constructor (appManager) {
    this.mainWindow = new MainWindow(null, appManager)
    this.settingWindow = new SettingWindow(null, appManager)
    this.iconSelectWindow = new IconSelectWindow(null, appManager)

    this.windowList = [];
    this.windowList.push(this.settingWindow);
    this.windowList.push(this.iconSelectWindow);
    this.windowList.push(this.mainWindow);
  }

  /* Create all windows */
  createAllWindows () {
    this.mainWindow.createWindow()
    this.settingWindow.createWindow(this.mainWindow.win)
    this.iconSelectWindow.createWindow(this.mainWindow.win)
  }

  sendUpgradeProgress(progress) {
    console.log('WindowManger: sendUpgradeProgress')
    if (this.mainWindow.isVisible()) {
      this.mainWindow.sendUpgradeProgress(progress);
    }
    if (this.settingWindow.isVisible()) {
      this.settingWindow.sendUpgradeProgress(progress);
    }
  }

  sendUpgradeComplete() {
    console.log('WindowManger: sendUpgradeComplete')
    if (this.mainWindow.isVisible()) {
      this.mainWindow.sendUpgradeComplete();
    }
    if (this.settingWindow.isVisible()) {
      this.settingWindow.sendUpgradeComplete();
    }
  }
}

export default WindowManager
