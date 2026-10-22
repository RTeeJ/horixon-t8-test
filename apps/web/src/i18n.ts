import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import th from './locales/th';

export const LANG_KEY = 'pos.lang';
export type Lang = 'en' | 'th';

function storedLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === 'en' || v === 'th') return v;
  } catch {
    /* storage unavailable */
  }
  return 'en';
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage unavailable */
  }
  void i18n.changeLanguage(lang);
}

void i18n.use(initReactI18next).init({
  resources: { en, th },
  lng: storedLang(),
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: Object.keys(en),
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18n;
