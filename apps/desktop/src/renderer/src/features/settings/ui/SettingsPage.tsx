import { LanguageSwitcher } from "../../../shared/i18n";
import { Eyebrow, Heading, Surface, Text } from "../../../shared/ui";
import "./styles.css";

export function SettingsPage(): React.JSX.Element {
  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <Eyebrow>PERSONAL PREFERENCES</Eyebrow>
        <Heading size="title">Settings</Heading>
        <Text size="lg">Configure how Mirror works for you.</Text>
      </header>

      <Surface as="section" className="settings-section" aria-labelledby="language-settings-title">
        <div className="settings-section__copy">
          <Heading level={2} size="section" id="language-settings-title">
            Language
          </Heading>
          <Text>
            Select the interface language. Translation resources can be connected to this setting later.
          </Text>
        </div>
        <LanguageSwitcher />
      </Surface>
    </div>
  );
}
