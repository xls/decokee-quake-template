import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import ContextMenu from '@imengyu/vue3-context-menu'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'
import i18n from '@/plugins/i18n'
import { SvgIcon } from '@/plugins/element'
import '@/assets/iconfont/iconfont.js'
import '@/assets/common.css'

const app = createApp(App)
app.use(ElementPlus)
app.use(ContextMenu)
app.use(i18n)

// Element Plus replaced the el-icon-* font classes with icon components; register
// them all globally so templates can use <el-icon><Name/></el-icon>.
for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(name, component)
}

// SvgIcon was globally registered in the Vue 2 entry; re-register it for Vue 3.
app.component('svg-icon', SvgIcon)

app.mount('#app')
