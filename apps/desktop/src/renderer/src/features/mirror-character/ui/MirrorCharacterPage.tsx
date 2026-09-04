import { useEffect, useState } from "react";
import type { CharacterSessionProgress, MirrorCharacter } from "@mirror/contracts";
import { Badge, Button, Eyebrow, Heading, Icon, Surface, Text, type IconName } from "../../../shared/ui";
import { characterStatDefinitions, getStatDelta, getXpProgress, type CharacterStatKey } from "../model/characterProgress";
import { MirrorAvatar } from "./MirrorAvatar";
import "./styles.css";

export interface MirrorCharacterPageProps {
  character: MirrorCharacter;
  latestProgress: CharacterSessionProgress;
}

const statIcons: Record<CharacterStatKey, IconName> = {
  focus: "target",
  stamina: "battery",
  execution: "bolt",
  discipline: "shield"
};

export function MirrorCharacterPage({
  character,
  latestProgress
}: MirrorCharacterPageProps): React.JSX.Element {
  const [animationRun, setAnimationRun] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const beforeProgress = getXpProgress(latestProgress.before);
  const afterProgress = getXpProgress(latestProgress.after);

  useEffect(() => {
    setShowResult(false);
    const frame = requestAnimationFrame(() => setShowResult(true));
    return () => cancelAnimationFrame(frame);
  }, [animationRun]);

  return (
    <div className="character-page">
      <header className="character-page__header">
        <div>
          <Eyebrow>YOUR GROWTH, MADE VISIBLE</Eyebrow>
          <Heading size="title">Mirror Character</Heading>
          <Text size="lg">Every focused session shapes the way your character grows.</Text>
        </div>
        <Badge tone="accent">
          <Icon name="sparkles" /> Base character
        </Badge>
      </header>

      <div className="character-overview">
        <Surface className="character-identity">
          <div className="character-identity__visual">
            <div key={animationRun} className="xp-burst" aria-live="polite">
              +{latestProgress.xpGained} XP
            </div>
            <MirrorAvatar />
          </div>
          <div className="character-identity__details">
            <div>
              <Badge tone="accent">Level {character.level}</Badge>
              <Heading level={2} size="section">{character.name}</Heading>
              <Text size="sm">Your steady guide for deliberate work.</Text>
            </div>

            <div className="xp-progress" aria-label={`${character.xp.current} of ${character.xp.required} XP`}>
              <div className="xp-progress__meta">
                <span>Progress to level {character.level + 1}</span>
                <strong>{character.xp.current} / {character.xp.required} XP</strong>
              </div>
              <div className="xp-progress__track">
                <span
                  className="xp-progress__before"
                  style={{ width: `${beforeProgress}%` }}
                />
                <span
                  className="xp-progress__earned"
                  style={{
                    left: `${beforeProgress}%`,
                    width: showResult ? `${Math.max(0, afterProgress - beforeProgress)}%` : "0%"
                  }}
                />
              </div>
            </div>
          </div>
        </Surface>

        <section className="character-stats" aria-labelledby="character-stats-title">
          <div className="character-section-heading">
            <div>
              <Eyebrow>CORE TRAITS</Eyebrow>
              <Heading level={2} size="section" id="character-stats-title">Current attributes</Heading>
            </div>
            <Text size="sm">0–100</Text>
          </div>

          <div className="character-stats__grid">
            {characterStatDefinitions.map((definition) => {
              const value = character.stats[definition.key];
              return (
                <Surface key={definition.key} variant="subtle" className="character-stat-card">
                  <span className="character-stat-card__icon"><Icon name={statIcons[definition.key]} /></span>
                  <div className="character-stat-card__value">{value}</div>
                  <strong>{definition.label}</strong>
                  <Text size="sm">{definition.description}</Text>
                  <div className="character-stat-card__track"><span style={{ width: `${value}%` }} /></div>
                </Surface>
              );
            })}
          </div>
        </section>
      </div>

      <Surface as="section" variant="raised" className="session-growth">
        <div className="character-section-heading">
          <div>
            <Eyebrow>LAST FOCUS SESSION</Eyebrow>
            <Heading level={2} size="section">Before and after</Heading>
          </div>
          <div className="session-growth__actions">
            <Badge tone="success">+{latestProgress.xpGained} XP earned</Badge>
            <Button variant="ghost" size="sm" icon="refresh" onClick={() => setAnimationRun((run) => run + 1)}>
              Replay XP
            </Button>
          </div>
        </div>

        <div className="session-growth__table" role="table" aria-label="Character stats before and after the last session">
          <div className="session-growth__row session-growth__row--header" role="row">
            <span role="columnheader">Attribute</span>
            <span role="columnheader">Before</span>
            <span role="columnheader">After</span>
            <span role="columnheader">Change</span>
          </div>
          {characterStatDefinitions.map((definition) => {
            const before = latestProgress.before.stats[definition.key];
            const after = latestProgress.after.stats[definition.key];
            const delta = getStatDelta(latestProgress, definition.key);
            return (
              <div className="session-growth__row" role="row" key={definition.key}>
                <span role="cell"><Icon name={statIcons[definition.key]} /> {definition.label}</span>
                <span role="cell">{before}</span>
                <strong role="cell">{after}</strong>
                <Badge tone={delta > 0 ? "success" : "neutral"}>{delta > 0 ? `+${delta}` : "—"}</Badge>
              </div>
            );
          })}
        </div>
      </Surface>
    </div>
  );
}
