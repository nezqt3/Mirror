import type { CharacterSessionProgress, MirrorCharacter } from "@mirror/contracts";

export const baseMirrorCharacter: MirrorCharacter = {
  id: "3e7b16a2-df69-4b4e-8f8f-e0a12f43babe",
  name: "Miro",
  archetype: "base",
  level: 7,
  xp: { current: 860, required: 1200 },
  stats: {
    focus: 74,
    stamina: 68,
    execution: 81,
    discipline: 76
  }
};

export const characterSessionProgress: CharacterSessionProgress = {
  sessionId: "8f7075d4-42c7-4cf7-b208-5236e42f9201",
  completedAt: "2026-09-02T08:00:00.000Z",
  xpGained: 180,
  before: {
    level: 7,
    xp: { current: 680, required: 1200 },
    stats: {
      focus: 72,
      stamina: 68,
      execution: 79,
      discipline: 75
    }
  },
  after: {
    level: baseMirrorCharacter.level,
    xp: baseMirrorCharacter.xp,
    stats: baseMirrorCharacter.stats
  }
};
