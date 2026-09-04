export const supportedLanguages = ["en", "zh", "ru"] as const;

export type LanguageCode = (typeof supportedLanguages)[number];

export interface LanguageConfig {
  defaultLanguage: LanguageCode;
  fallbackLanguage: LanguageCode;
  storageKey: string;
  supportedLanguages: readonly LanguageCode[];
}

export const languageConfig: LanguageConfig = {
  defaultLanguage: "en",
  fallbackLanguage: "en",
  storageKey: "mirror.language",
  supportedLanguages,
};

export const languageLabels: Record<LanguageCode, string> = {
  en: "English",
  zh: "中文",
  ru: "Русский",
};

export function isLanguageCode(value: string): value is LanguageCode {
  return languageConfig.supportedLanguages.includes(value as LanguageCode);
}

export function resolveLanguage(value?: string | null): LanguageCode {
  if (!value) return languageConfig.fallbackLanguage;

  const normalized = value.toLowerCase();
  if (isLanguageCode(normalized)) return normalized;

  const [primaryLanguage] = normalized.split("-");
  return primaryLanguage && isLanguageCode(primaryLanguage)
    ? primaryLanguage
    : languageConfig.fallbackLanguage;
}
