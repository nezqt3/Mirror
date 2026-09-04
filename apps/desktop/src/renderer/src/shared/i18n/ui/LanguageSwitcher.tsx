import { Button } from "../../ui";
import { languageConfig, languageLabels } from "../config";
import { useLanguage } from "../LanguageProvider";
import "./styles.css";

export interface LanguageSwitcherProps {
  label?: string;
}

export function LanguageSwitcher({ label = "Interface language" }: LanguageSwitcherProps): React.JSX.Element {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="language-switcher" role="radiogroup" aria-label={label}>
      {languageConfig.supportedLanguages.map((code) => {
        const selected = language === code;
        return (
          <Button
            key={code}
            type="button"
            size="sm"
            variant={selected ? "secondary" : "ghost"}
            className={selected ? "language-switcher__option active" : "language-switcher__option"}
            role="radio"
            aria-checked={selected}
            onClick={() => setLanguage(code)}
          >
            {languageLabels[code]}
          </Button>
        );
      })}
    </div>
  );
}
