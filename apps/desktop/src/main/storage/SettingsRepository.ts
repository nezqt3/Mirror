import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_PRIVACY_SETTINGS,
  privacySettingsSchema,
  type PrivacySettings
} from "@mirror/contracts";

export interface SettingsRepository {
  getPrivacySettings(): Promise<PrivacySettings>;
  savePrivacySettings(settings: PrivacySettings): Promise<PrivacySettings>;
}

export class LocalSettingsRepository implements SettingsRepository {
  private readonly filePath: string;

  constructor(private readonly rootDirectory: string) {
    this.filePath = join(rootDirectory, "privacy-settings.json");
  }

  async getPrivacySettings(): Promise<PrivacySettings> {
    try {
      const raw: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
      return privacySettingsSchema.parse(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return structuredClone(DEFAULT_PRIVACY_SETTINGS);
      }
      throw new Error("Unable to read local privacy settings", { cause: error });
    }
  }

  async savePrivacySettings(input: PrivacySettings): Promise<PrivacySettings> {
    const settings = privacySettingsSchema.parse(input);
    await mkdir(this.rootDirectory, { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
    return settings;
  }
}
