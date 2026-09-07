import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import settingsEn from "./features/settings/locales/en.json";
import settingsRu from "./features/settings/locales/ru.json";
import settingsZh from "./features/settings/locales/zh.json";

import characterEn from "./features/mirror-character/locales/en.json";
import characterRu from "./features/mirror-character/locales/ru.json";
import characterZh from "./features/mirror-character/locales/zh.json";

import appEn from "./locales/en.json";
import appRu from "./locales/ru.json";
import appZh from "./locales/zh.json";

import focusEn from "./features/focus-session/locales/en.json";
import focusRu from "./features/focus-session/locales/ru.json";
import focusZh from "./features/focus-session/locales/zh.json";

import analyticsEn from "./features/analytics/locales/en.json";
import analyticsRu from "./features/analytics/locales/ru.json";
import analyticsZh from "./features/analytics/locales/zh.json";

import { languageConfig } from "./shared/i18n/config";

void i18n.use(initReactI18next).init({
  resources: {
    en: { settings: settingsEn, character: characterEn, app: appEn, focus: focusEn, analytics: analyticsEn },
    ru: { settings: settingsRu, character: characterRu, app: appRu, focus: focusRu, analytics: analyticsRu },
    zh: { settings: settingsZh, character: characterZh, app: appZh, focus: focusZh, analytics: analyticsZh },
  },
  lng: languageConfig.defaultLanguage,
  fallbackLng: languageConfig.fallbackLanguage,
  supportedLngs: [...languageConfig.supportedLanguages],
  defaultNS: "settings",
  interpolation: { escapeValue: false },
});

export { i18n };
