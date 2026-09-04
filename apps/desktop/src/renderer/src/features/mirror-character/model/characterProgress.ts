import type { CharacterSessionProgress, CharacterSnapshot, CharacterStats } from "@mirror/contracts";

export type CharacterStatKey = keyof CharacterStats;

export interface CharacterStatDefinition {
  key: CharacterStatKey;
  label: string;
  description: string;
}

export const characterStatDefinitions: CharacterStatDefinition[] = [
  { key: "focus", label: "Focus", description: "Staying with the intended task" },
  { key: "stamina", label: "Stamina", description: "Sustaining productive energy" },
  { key: "execution", label: "Execution", description: "Turning intent into completed work" },
  { key: "discipline", label: "Discipline", description: "Returning to the plan consistently" }
];

export function getXpProgress(snapshot: CharacterSnapshot): number {
  if (snapshot.xp.required <= 0) return 0;
  return Math.min(100, Math.max(0, (snapshot.xp.current / snapshot.xp.required) * 100));
}

export function getStatDelta(
  progress: CharacterSessionProgress,
  stat: CharacterStatKey
): number {
  return progress.after.stats[stat] - progress.before.stats[stat];
}

export function didLevelUp(progress: CharacterSessionProgress): boolean {
  return progress.after.level > progress.before.level;
}
