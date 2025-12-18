// 语言切换 composable
import { ref, computed } from 'vue'
import { translations, type Language, type TranslationKey } from '../i18n'

// 全局语言状态
const currentLanguage = ref<Language>('zh')

// 检测系统语言并设置初始值
const systemLang = navigator.language.toLowerCase()
if (systemLang.startsWith('en')) {
    currentLanguage.value = 'en'
}

// 从 localStorage 读取保存的语言设置
const savedLang = localStorage.getItem('cleanc-language') as Language
if (savedLang === 'zh' || savedLang === 'en') {
    currentLanguage.value = savedLang
}

export function useLanguage() {
    // 当前翻译对象
    const t = computed(() => translations[currentLanguage.value])

    // 切换语言
    function toggleLanguage() {
        currentLanguage.value = currentLanguage.value === 'zh' ? 'en' : 'zh'
        localStorage.setItem('cleanc-language', currentLanguage.value)
    }

    // 设置语言
    function setLanguage(lang: Language) {
        currentLanguage.value = lang
        localStorage.setItem('cleanc-language', lang)
    }

    // 获取翻译文本（支持插值）
    function translate(key: TranslationKey, params?: Record<string, string | number>): string {
        let text = t.value[key] || key
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                text = text.replace(`{${k}}`, String(v))
            }
        }
        return text
    }

    return {
        lang: currentLanguage,
        t,
        toggleLanguage,
        setLanguage,
        translate
    }
}
