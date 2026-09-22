import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en";
import { zh } from "./zh";

export const i18nReady = i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: "zh",
  fallbackLng: "zh",
  supportedLngs: ["zh", "en"],
  interpolation: { escapeValue: false },
});

export default i18n;
