import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  CharacterSessionProgress,
  MirrorCharacter,
} from "@mirror/contracts";
import {
  Badge,
  Button,
  Eyebrow,
  Heading,
  Icon,
  Surface,
  Text,
  type IconName,
} from "../../../shared/ui";
import {
  characterStatDefinitions,
  getStatDelta,
  getXpProgress,
  type CharacterStatKey,
} from "../model/characterProgress";
import { MirrorAvatar } from "./MirrorAvatar";
import "./styles.css";

export interface MirrorCharacterPageProps {
  character: MirrorCharacter;
  latestProgress?: CharacterSessionProgress;
}

const statIcons: Record<CharacterStatKey, IconName> = {
  focus: "target",
  stamina: "battery",
  execution: "bolt",
  discipline: "shield",
};

export function MirrorCharacterPage({
  character,
  latestProgress,
}: MirrorCharacterPageProps): React.JSX.Element {
  const { t } = useTranslation("character");

  const [animationRun, setAnimationRun] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const currentProgress = Math.min(100, (character.xp.current / character.xp.required) * 100);
  const beforeProgress = latestProgress ? getXpProgress(latestProgress.before) : currentProgress;
  const afterProgress = latestProgress ? getXpProgress(latestProgress.after) : currentProgress;

  useEffect(() => {
    setShowResult(false);

    const frame = requestAnimationFrame(() => setShowResult(true));

    return () => cancelAnimationFrame(frame);
  }, [animationRun]);

  return (
    <div className="character-page">
      <header className="character-page__header">
        <div>
          <Eyebrow>{t("header.eyebrow")}</Eyebrow>

          <Heading size="title">{t("header.title")}</Heading>

          <Text size="lg">{t("header.description")}</Text>
        </div>

        <Badge tone="accent">
          <Icon name="sparkles" />
          {t("header.baseCharacter")}
        </Badge>
      </header>

      <div className="character-overview">
        <Surface className="character-identity">
          <div className="character-identity__visual">
            {latestProgress && (
              <div key={animationRun} className="xp-burst" aria-live="polite">
                +{latestProgress.xpGained} XP
              </div>
            )}

            <MirrorAvatar />
          </div>

          <div className="character-identity__details">
            <div>
              <Badge tone="accent">
                {t("identity.level", {
                  level: character.level,
                })}
              </Badge>

              <Heading level={2} size="section">
                {character.name}
              </Heading>

              <Text size="sm">{t("identity.description")}</Text>
            </div>

            <div
              className="xp-progress"
              aria-label={t("identity.xpAriaLabel", {
                current: character.xp.current,
                required: character.xp.required,
              })}
            >
              <div className="xp-progress__meta">
                <span>
                  {t("identity.progressToLevel", {
                    level: character.level + 1,
                  })}
                </span>

                <strong>
                  {character.xp.current} / {character.xp.required} XP
                </strong>
              </div>

              <div className="xp-progress__track">
                <span
                  className="xp-progress__before"
                  style={{
                    width: `${beforeProgress}%`,
                  }}
                />

                <span
                  className="xp-progress__earned"
                  style={{
                    left: `${beforeProgress}%`,
                    width: showResult
                      ? `${Math.max(0, afterProgress - beforeProgress)}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        </Surface>

        <section
          className="character-stats"
          aria-labelledby="character-stats-title"
        >
          <div className="character-section-heading">
            <div>
              <Eyebrow>{t("stats.eyebrow")}</Eyebrow>

              <Heading level={2} size="section" id="character-stats-title">
                {t("stats.title")}
              </Heading>
            </div>

            <Text size="sm">0–100</Text>
          </div>

          <div className="character-stats__grid">
            {characterStatDefinitions.map((definition) => {
              const value = character.stats[definition.key];

              return (
                <Surface
                  key={definition.key}
                  variant="subtle"
                  className="character-stat-card"
                >
                  <span className="character-stat-card__icon">
                    <Icon name={statIcons[definition.key]} />
                  </span>

                  <div className="character-stat-card__value">{value}</div>

                  <strong>{t(`stats.items.${definition.key}.label`)}</strong>

                  <Text size="sm">
                    {t(`stats.items.${definition.key}.description`)}
                  </Text>

                  <div className="character-stat-card__track">
                    <span
                      style={{
                        width: `${value}%`,
                      }}
                    />
                  </div>
                </Surface>
              );
            })}
          </div>
        </section>
      </div>

      {latestProgress && <Surface as="section" variant="raised" className="session-growth">
        <div className="character-section-heading">
          <div>
            <Eyebrow>{t("session.eyebrow")}</Eyebrow>

            <Heading level={2} size="section">
              {t("session.title")}
            </Heading>
          </div>

          <div className="session-growth__actions">
            <Badge tone="success">
              {t("session.xpEarned", {
                xp: latestProgress.xpGained,
              })}
            </Badge>

            <Button
              variant="ghost"
              size="sm"
              icon="refresh"
              onClick={() => setAnimationRun((run) => run + 1)}
            >
              {t("session.replayXp")}
            </Button>
          </div>
        </div>

        <div
          className="session-growth__table"
          role="table"
          aria-label={t("session.table.ariaLabel")}
        >
          <div
            className="session-growth__row session-growth__row--header"
            role="row"
          >
            <span role="columnheader">{t("session.table.attribute")}</span>

            <span role="columnheader">{t("session.table.before")}</span>

            <span role="columnheader">{t("session.table.after")}</span>

            <span role="columnheader">{t("session.table.change")}</span>
          </div>

          {characterStatDefinitions.map((definition) => {
            const before = latestProgress.before.stats[definition.key];

            const after = latestProgress.after.stats[definition.key];

            const delta = getStatDelta(latestProgress, definition.key);

            return (
              <div
                className="session-growth__row"
                role="row"
                key={definition.key}
              >
                <span role="cell">
                  <Icon name={statIcons[definition.key]} />{" "}
                  {t(`stats.items.${definition.key}.label`)}
                </span>

                <span role="cell">{before}</span>

                <strong role="cell">{after}</strong>

                <Badge tone={delta > 0 ? "success" : "neutral"}>
                  {delta > 0 ? `+${delta}` : "—"}
                </Badge>
              </div>
            );
          })}
        </div>
      </Surface>}
    </div>
  );
}
