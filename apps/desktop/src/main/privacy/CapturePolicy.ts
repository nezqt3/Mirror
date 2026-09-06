import type { CaptureEvent, PrivacySettings } from "@mirror/contracts";

const normalized = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLocaleLowerCase() : "";

const containsAny = (value: unknown, candidates: readonly string[]): boolean => {
  const haystack = normalized(value);
  return haystack.length > 0 && candidates.some((candidate) => haystack.includes(normalized(candidate)));
};

const equalsAny = (value: unknown, candidates: readonly string[]): boolean => {
  const target = normalized(value);
  return target.length > 0 && candidates.some((candidate) => target === normalized(candidate));
};

function eventDomain(payload: Record<string, unknown>): string {
  const explicit = normalized(payload.domain);
  if (explicit) return explicit;
  if (typeof payload.url !== "string") return "";
  try {
    return new URL(payload.url).hostname.toLocaleLowerCase();
  } catch {
    return "";
  }
}

/** Privacy boundary shared by all capture adapters before data is persisted. */
export function applyCapturePolicy(
  event: CaptureEvent,
  settings: PrivacySettings
): CaptureEvent | null {
  const payload = event.payload;
  const blockedApplication =
    equalsAny(payload.applicationName ?? payload.appName, settings.blockedApplications) ||
    equalsAny(payload.bundleIdentifier ?? payload.bundleId, settings.blockedApplications) ||
    equalsAny(payload.executableName, settings.blockedApplications);
  if (blockedApplication) return null;

  const title = payload.windowTitle ?? payload.title;
  if (containsAny(title, settings.blockedWindowTitleKeywords)) return null;

  const domain = eventDomain(payload);
  const blockedDomain = settings.blockedDomains.some((candidate) => {
    const rule = normalized(candidate).replace(/^\.+/, "");
    return rule.length > 0 && (domain === rule || domain.endsWith(`.${rule}`));
  });
  if (blockedDomain) return null;

  if (!settings.captureWindowTitles && ("windowTitle" in payload || "title" in payload)) {
    const sanitizedPayload = { ...payload };
    delete sanitizedPayload.windowTitle;
    delete sanitizedPayload.title;
    return { ...event, payload: sanitizedPayload };
  }

  return event;
}
