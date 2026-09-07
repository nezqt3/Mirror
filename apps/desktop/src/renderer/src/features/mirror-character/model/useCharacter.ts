import type { MirrorCharacter } from "@mirror/contracts";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../shared/api";
import { characterApi, type CreateCharacterPayload } from "../api/characterApi";

export function useCharacter() {
  const [character, setCharacter] = useState<MirrorCharacter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isMissing, setIsMissing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setIsMissing(false);
    setError(null);
    try {
      setCharacter(await characterApi.get());
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        setCharacter(null);
        setIsMissing(true);
      } else {
        setError(caught instanceof ApiError ? caught : new ApiError("Unable to load character"));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async (payload: CreateCharacterPayload) => {
    setIsCreating(true);
    setError(null);
    try {
      setCharacter(await characterApi.create(payload));
      setIsMissing(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError("Unable to create character"));
    } finally {
      setIsCreating(false);
    }
  }, []);

  return { character, isLoading, isCreating, isMissing, error, create, reload: load };
}
