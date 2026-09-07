import type { MirrorCharacter } from "@mirror/contracts";
import { API_ENDPOINTS, apiClient } from "../../../shared/api";

export interface CharacterResponse {
  id: string;
  name: string;
  avatar_key: string | null;
  level: number;
  xp: number;
  focus: number;
  stamina: number;
  execution: number;
  discipline: number;
  current_streak: number;
  longest_streak: number;
  last_session_date: string | null;
  adaptability: number;
  energy: number;
}

export interface CreateCharacterPayload {
  name: string;
  avatar_key?: string | null;
}

function toPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function toMirrorCharacter(character: CharacterResponse): MirrorCharacter {
  return {
    id: character.id,
    name: character.name,
    archetype: "base",
    level: character.level,
    xp: {
      current: character.xp,
      required: character.level * 500
    },
    stats: {
      focus: toPercent(character.focus),
      stamina: toPercent(character.stamina),
      execution: toPercent(character.execution),
      discipline: toPercent(character.discipline)
    }
  };
}

export const characterApi = {
  async get(): Promise<MirrorCharacter> {
    const character = await apiClient.request<CharacterResponse>(API_ENDPOINTS.character.root);
    return toMirrorCharacter(character);
  },

  async create(payload: CreateCharacterPayload): Promise<MirrorCharacter> {
    const character = await apiClient.request<CharacterResponse>(API_ENDPOINTS.character.root, {
      method: "POST",
      body: payload
    });
    return toMirrorCharacter(character);
  }
};
