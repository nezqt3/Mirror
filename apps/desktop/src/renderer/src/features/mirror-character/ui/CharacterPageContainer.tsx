import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { AutoField, Button, Eyebrow, Heading, Surface, Text } from "../../../shared/ui";
import { useCharacter } from "../model/useCharacter";
import { MirrorCharacterPage } from "./MirrorCharacterPage";

export function CharacterPageContainer(): React.JSX.Element {
  const { t } = useTranslation("character");
  const { character, isLoading, isCreating, isMissing, error, create, reload } = useCharacter();
  const [name, setName] = useState("");

  if (isLoading) {
    return <div className="character-page character-state"><Text>{t("state.loading")}</Text></div>;
  }

  if (error && !isMissing) {
    return (
      <div className="character-page character-state">
        <Surface className="character-state__card">
          <Heading level={2} size="section">{t("state.errorTitle")}</Heading>
          <Text tone="secondary">{error.message}</Text>
          <Button type="button" variant="secondary" onClick={() => void reload()}>{t("state.retry")}</Button>
        </Surface>
      </div>
    );
  }

  if (!character) {
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = name.trim();
      if (trimmedName) void create({ name: trimmedName });
    };

    return (
      <div className="character-page character-state">
        <Surface as="section" className="character-state__card">
          <Eyebrow>{t("setup.eyebrow")}</Eyebrow>
          <Heading level={1} size="section">{t("setup.title")}</Heading>
          <Text tone="secondary">{t("setup.description")}</Text>
          <form className="character-setup-form" onSubmit={handleSubmit}>
            <AutoField
              label={t("setup.name")}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={1}
              maxLength={80}
              autoFocus
            />
            {error && <p className="ui-field__error" role="alert">{error.message}</p>}
            <Button type="submit" loading={isCreating}>{t("setup.submit")}</Button>
          </form>
        </Surface>
      </div>
    );
  }

  return <MirrorCharacterPage character={character} />;
}
