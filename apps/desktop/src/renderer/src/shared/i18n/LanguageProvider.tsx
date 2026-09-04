import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { isLanguageCode, languageConfig, type LanguageCode } from "./config";

export interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): LanguageCode {
  try {
    const storedLanguage = window.localStorage.getItem(languageConfig.storageKey);
    return storedLanguage && isLanguageCode(storedLanguage)
      ? storedLanguage
      : languageConfig.defaultLanguage;
  } catch {
    return languageConfig.defaultLanguage;
  }
}

export interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps): React.JSX.Element {
  const [language, setLanguage] = useState<LanguageCode>(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(languageConfig.storageKey, language);
    } catch {
      // Language still applies for this session when storage is unavailable.
    }
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
