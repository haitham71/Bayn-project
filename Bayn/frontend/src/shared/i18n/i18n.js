import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar.json';
import en from './en.json';

const STORAGE_KEY = 'bayn-lang';
export const SUPPORTED_LANGS = ['ar', 'en'];

// The language for a fresh visit with no URL prefix: a saved choice wins, then
// the browser's preferred language (Accept-Language), then Arabic (Bayn is
// Arabic-first).
export function detectLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  } catch {
    // storage unavailable — ignore
  }
  const prefs =
    typeof navigator !== 'undefined'
      ? (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])
      : [];
  for (const pref of prefs || []) {
    const code = (pref || '').slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGS.includes(code)) return code;
  }
  return 'ar';
}

const defaultLang = detectLang();

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: defaultLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

// Keep the document direction/lang in sync with the active language.
function applyDir(lng) {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // storage unavailable (private mode) — ignore
  }
}

applyDir(i18n.language);
i18n.on('languageChanged', applyDir);

export default i18n;
