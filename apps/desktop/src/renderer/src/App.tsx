import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SessionState } from "@mirror/contracts";
import {
  Badge,
  Button,
  Eyebrow,
  Field,
  Heading,
  Icon,
  Select,
  Surface,
  Text,
  Textarea,
  type BadgeTone,
  type IconName,
} from "./shared/ui";
import {
  baseMirrorCharacter,
  characterSessionProgress,
  MirrorCharacterPage,
} from "./features/mirror-character";
import { SettingsPage } from "./features/settings";
import { toAnalysisLocale, useLanguage } from "./shared/i18n";
import mirrorAvatar from "./assets/mirror-avatar.png";

type View = "home" | "sessions" | "insights" | "character" | "settings";

const navigation: Array<{ id: View; icon: IconName }> = [
  { id: "home", icon: "home" },
  { id: "sessions", icon: "clock" },
  { id: "insights", icon: "insights" },
  { id: "character", icon: "character" },
  { id: "settings", icon: "settings" },
];

const DURATION_STORAGE_KEY = "mirror.default-duration";

function readStoredDuration(): number {
  const value = Number(window.localStorage.getItem(DURATION_STORAGE_KEY));

  return [25, 45, 60, 90, 120].includes(value) ? value : 90;
}

const idleState: SessionState = {
  status: "idle",
  sessionId: null,
  config: null,
  startedAt: null,
  plannedEndsAt: null,
  eventCount: 0,
  error: null,
};

export function App(): React.JSX.Element {
  const { t } = useTranslation("app");
  const { language } = useLanguage();

  const [activeView, setActiveView] = useState<View>("home");
  const [goal, setGoal] = useState(() => t("home.session.defaultGoal"));
  const [durationMinutes, setDurationMinutes] = useState(readStoredDuration);
  const [session, setSession] = useState<SessionState>(idleState);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const api = window.mirror;

    if (!api) {
      setError(t("errors.bridgeUnavailable"));
      return undefined;
    }

    void api
      .getSessionState()
      .then(setSession)
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : t("errors.readSession"),
        );
      });

    return api.onSessionStateChanged(setSession);
  }, [t]);

  useEffect(() => {
    window.localStorage.setItem(DURATION_STORAGE_KEY, String(durationMinutes));
  }, [durationMinutes]);

  useEffect(() => {
    if (session.status !== "running" || !session.plannedEndsAt) {
      return undefined;
    }

    setNow(Date.now());

    const interval = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => window.clearInterval(interval);
  }, [session.status, session.plannedEndsAt]);

  const isActive = ["starting", "running", "stopping"].includes(session.status);

  const statusLabel = useMemo(
    () => t(`status.${session.status}`),
    [session.status, t],
  );

  const statusTone: BadgeTone =
    session.status === "running"
      ? "success"
      : session.status === "failed"
        ? "danger"
        : ["starting", "stopping"].includes(session.status)
          ? "warning"
          : "neutral";

  const remainingSeconds = session.plannedEndsAt
    ? Math.max(
        0,
        Math.ceil((new Date(session.plannedEndsAt).getTime() - now) / 1_000),
      )
    : durationMinutes * 60;

  const remainingLabel = `${String(Math.floor(remainingSeconds / 60)).padStart(
    2,
    "0",
  )}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  const activeNavigationItem = navigation.find(
    (item) => item.id === activeView,
  );

  const toggleSession = async (): Promise<void> => {
    setError(null);

    try {
      const api = window.mirror;

      if (!api) {
        throw new Error(t("errors.bridgeUnavailableShort"));
      }

      if (session.status === "running") {
        await api.stopSession();
      } else {
        await api.startSession({
          goal,
          durationMinutes,
          captureScreenshots: false,
          clientTimezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          analysisLocale: toAnalysisLocale(language),
        });
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("errors.updateSession"),
      );
    }
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <img src={mirrorAvatar} alt="" />
          </span>

          <span className="brand-name">Mirror</span>
        </div>

        <nav className="navigation" aria-label={t("navigation.ariaLabel")}>
          {navigation.map((item) => {
            const label = t(`navigation.${item.id}`);

            return (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                size="md"
                icon={item.icon}
                className={
                  activeView === item.id ? "nav-item active" : "nav-item"
                }
                onClick={() => setActiveView(item.id)}
                aria-current={activeView === item.id ? "page" : undefined}
                title={label}
              >
                {label}
              </Button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span className="avatar">DA</span>

          <div>
            <strong>Denis</strong>
            <span>{t("sidebar.workspace")}</span>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="workspace-label">{t("topbar.workspace")}</p>

            <strong>
              {activeNavigationItem
                ? t(`navigation.${activeNavigationItem.id}`)
                : ""}
            </strong>
          </div>

          <Badge tone={statusTone} dot>
            {statusLabel}
          </Badge>
        </header>

        {activeView === "home" ? (
          <div className="page-content">
            <section className="hero">
              <Eyebrow>{t("home.hero.eyebrow")}</Eyebrow>

              <Heading>{t("home.hero.title")}</Heading>

              <Text size="lg" className="subtitle">
                {t("home.hero.description")}
              </Text>
            </section>

            <Surface as="section" className="session-card">
              {isActive ? (
                <div
                  className="countdown"
                  aria-live="polite"
                  aria-label={t("home.session.secondsRemaining", {
                    seconds: remainingSeconds,
                  })}
                >
                  <span>{t("home.session.timeRemaining")}</span>

                  <strong>{remainingLabel}</strong>
                </div>
              ) : null}

              <Field label={t("home.session.goal")} htmlFor="goal">
                <Textarea
                  id="goal"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  disabled={isActive}
                  maxLength={500}
                  rows={3}
                />
              </Field>

              <div className="controls">
                <Field
                  className="duration"
                  label={t("home.session.duration")}
                  htmlFor="duration"
                >
                  <Select
                    id="duration"
                    value={durationMinutes}
                    onChange={(event) =>
                      setDurationMinutes(Number(event.target.value))
                    }
                    disabled={isActive}
                  >
                    {[25, 45, 60, 90, 120].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {t("home.session.minutes", {
                          minutes,
                        })}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Button
                  type="button"
                  size="lg"
                  variant={session.status === "running" ? "danger" : "primary"}
                  icon={session.status === "running" ? "stop" : "play"}
                  loading={
                    session.status === "starting" ||
                    session.status === "stopping"
                  }
                  className="session-action"
                  onClick={() => void toggleSession()}
                  disabled={!window.mirror}
                >
                  {session.status === "running"
                    ? t("home.session.finish")
                    : t("home.session.start")}
                </Button>
              </div>

              {error ? (
                <p className="session-error" role="alert">
                  <Icon name="alert" />
                  {error}
                </p>
              ) : null}
            </Surface>

            <section
              className="metrics"
              aria-label={t("home.metrics.ariaLabel")}
            >
              <Surface as="article" variant="subtle">
                <span>{t("home.metrics.capturedSignals")}</span>

                <strong>{session.eventCount}</strong>
              </Surface>

              <Surface as="article" variant="subtle">
                <span>{t("home.metrics.privacyMode")}</span>

                <strong>{t("home.metrics.privacyOn")}</strong>
              </Surface>

              <Surface as="article" variant="subtle">
                <span>{t("home.metrics.timer")}</span>

                <strong>
                  {isActive
                    ? remainingLabel
                    : t("home.session.minutes", {
                        minutes: durationMinutes,
                      })}
                </strong>
              </Surface>
            </section>
          </div>
        ) : activeView === "character" ? (
          <MirrorCharacterPage
            character={baseMirrorCharacter}
            latestProgress={characterSessionProgress}
          />
        ) : activeView === "settings" ? (
          <SettingsPage />
        ) : (
          <section className="empty-page">
            <span className="empty-icon">
              <Icon name={activeNavigationItem?.icon ?? "home"} size={20} />
            </span>

            <Eyebrow>{t("empty.eyebrow")}</Eyebrow>

            <Heading size="title">
              {activeNavigationItem
                ? t(`navigation.${activeNavigationItem.id}`)
                : ""}
            </Heading>

            <Text>{t("empty.description")}</Text>
          </section>
        )}
      </div>
    </main>
  );
}
