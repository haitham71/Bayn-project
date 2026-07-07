import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar.json';
import en from './en.json';

const STORAGE_KEY = 'bayn-lang';
const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

// Bayn is Arabic-first; a saved choice always wins.
const defaultLang = saved || 'ar';

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
