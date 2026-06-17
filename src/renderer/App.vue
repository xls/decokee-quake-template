<template>
    <div id="app" :style="{ height: (windowHeight + 'px'), maxHeight: (windowHeight + 'px') }">
        <div id="content">
            <MainView v-if="renderReady && windowTitle === 'DecoKeeAI'"/>
            <SettingsView v-else-if="renderReady && windowTitle === 'Settings'"/>
            <IconSelectView v-else-if="renderReady && windowTitle === 'IconSelect'"/>
        </div>
    </div>
</template>

<script>
import MainView from '@/views/MainView/MainView'
import SettingsView from "@/views/Setting/SettingsView";
import IconSelectView from "@/views/IconSelect/IconSelectView";
import {setI18nLanguage} from "@/plugins/i18n";

// @electron/remote is accessed via nodeIntegration; use window.require to avoid Vite bundling it
const remote = window.require ? window.require('@electron/remote') : null;

export default {
    name: 'app',
    components: {
        MainView,
        SettingsView,
        IconSelectView
    },
    data() {
        return {
            renderReady: false,
            windowTitle: '',
            windowHeight: window.innerHeight
        }
    },
    mounted() {
        this.genRenderer()
        window.addEventListener('resize', this.handleResize);
        console.log(this.windowTitle + ' process.version', process.version);
        console.log(this.windowTitle + ' process.versions.electron', process.versions.electron);
        console.log(this.windowTitle + ' process.versions.modules', process.versions.modules);
    },
    methods: {
        genRenderer() {
            if (!remote) {
                console.error('App.vue: @electron/remote not available')
                return
            }
            window.platform = remote.getGlobal('platform');
            window.arch = remote.getGlobal('arch');
            this.windowTitle = remote.getCurrentWindow().getTitle()
            window.appManager = remote.getGlobal('appManager');
            window.store = remote.getGlobal('appManager').storeManager;
            window.windowManager = remote.getGlobal('appManager').windowManager;
            window.resourcesManager = remote.getGlobal('appManager').resourcesManager;
            if (window.electron) {
                window.electron.remote = remote;
            }
            window.app = remote.app;

            window.installPath = remote.getGlobal('installPath');
            window.userDataPath = remote.getGlobal('userDataPath');

            window.shell = remote.getGlobal('shell');
            window.clipboard = remote.getGlobal('clipboard');
            window.fs = remote.getGlobal('fs');
            window.path = remote.getGlobal('path');
            const newSetTimeout = remote.getGlobal('setTimeout');
            const newSetInterval = remote.getGlobal('setInterval');
            const newClearTimeout = remote.getGlobal('clearTimeout');
            const newClearInterval = remote.getGlobal('clearInterval');
            const globalShortcut = remote.getGlobal('globalShortcut');
            window.currentNetworkRegIs5G = false;
            console.log = remote.getGlobal('log');
            window.setTimeout = newSetTimeout;
            window.setInterval = newSetInterval;
            window.clearTimeout = newClearTimeout;
            window.clearInterval = newClearInterval;
            window.globalShortcut = globalShortcut;

            const savedLocale = window.store.storeGet('system.locale');
            this.localeValue = (savedLocale === 'zh') ? 0 : 1;
            this.$i18n.locale = savedLocale;

            setI18nLanguage(savedLocale);

            this.renderReady = true;
        },
        handleLocaleChange() {
            console.log('Locale change to ' + this.localeValue)
            const newLocale = (this.localeValue === 0) ? 'zh' : 'en';
            this.$i18n.locale = newLocale
            setI18nLanguage(newLocale);
            window.store.storeSet('system.locale', newLocale);
        },
        handleResize() {
            this.windowHeight = window.innerHeight;
        },

    }
}
</script>

<style lang="less">
body {
    margin: 0;
    user-select: none;
}

input {
    outline: none;
}

a {
    outline: none;
    text-decoration: none;
    -webkit-user-drag: none;
    color: #B2CCD6;
}

img {
    -webkit-user-drag: none;
}

#app {
    height: 100%;
    width: 100vw;
    background-color: #2D3A41;
    color: #B2CCD6;
    font-family: 'Microsoft YaHei', 'Avenir', 'Helvetica', 'Arial', 'sans-serif';
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -moz-user-select: none;
    -webkit-user-select: none;
    user-select: none;
    position: relative;
    top: 0;
    left: 0;
}


#footer {
    width: 100%;
    height: 9%;
    padding: 0 10px;
    align-items: center;
    bottom: 5px;
    position: absolute;
}

.dropdown-div {
    padding: 0 8px;
    line-height: 32px;
}

.dropdown-link {
    transition: .2s ease;
    color: #FFF;
    opacity: 0.7;
}

.dropdown-link:hover {
    color: #409EFF;
}

.icon-arrow-down {
    font-size: 12px;
}

:deep(.adsDialogClass) {
    padding: 0;
    margin: 0 auto;
}

</style>
