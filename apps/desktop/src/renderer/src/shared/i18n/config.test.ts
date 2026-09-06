import { describe, expect, it } from "vitest";
import { languageConfig, resolveLanguage, toAnalysisLocale } from "./config.js";

describe("language configuration", () => {
  it("resolves supported regional locales", () => {
    expect(resolveLanguage("zh-CN")).toBe("zh");
    expect(resolveLanguage("en-US")).toBe("en");
  });

  it("uses the backend locale expected for Chinese analysis", () => {
    expect(toAnalysisLocale("zh")).toBe("zh-CN");
    expect(toAnalysisLocale("ru")).toBe("ru");
  });

  it("uses the configured fallback for unknown locales", () => {
    expect(resolveLanguage("de-DE")).toBe(languageConfig.fallbackLanguage);
  });
});
