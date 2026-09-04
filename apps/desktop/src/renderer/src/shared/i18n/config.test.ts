import { describe, expect, it } from "vitest";
import { languageConfig, resolveLanguage } from "./config.js";

describe("language configuration", () => {
  it("resolves supported regional locales", () => {
    expect(resolveLanguage("zh-CN")).toBe("zh");
    expect(resolveLanguage("en-US")).toBe("en");
  });

  it("uses the configured fallback for unknown locales", () => {
    expect(resolveLanguage("ru-RU")).toBe(languageConfig.fallbackLanguage);
  });
});
