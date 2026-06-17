import { createI18n } from 'vue-i18n'

function loadLocaleMessages() {
    // import.meta.glob is processed at build time by Vite for both main and renderer
    const localeFiles = import.meta.glob('../locales/*.json', { eager: true })
    const messages = {}
    for (const filePath in localeFiles) {
        const matched = filePath.match(/([A-Za-z0-9-_]+)\./i)
        if (matched && matched.length > 1) {
            const locale = matched[1]
            messages[locale] = localeFiles[filePath].default || localeFiles[filePath]
        }
    }
    return messages
}

export function i18nRender(key) {
    return i18n.global.t(key)
}

export function setI18nLanguage(lang) {
    i18n.global.locale = lang
    return lang
}

const i18n = createI18n({
    legacy: true,
    locale: 'zh',
    fallbackLocale: 'zh',
    messages: loadLocaleMessages()
})

export default i18n
