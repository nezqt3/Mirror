import React, { useEffect, useMemo, useState } from "react";
import type { SessionState } from "@mirror/contracts";
import { Badge, Button, Eyebrow, Field, Heading, Icon, Select, Surface, Text, Textarea, type BadgeTone, type IconName } from "./shared/ui";
import { baseMirrorCharacter, characterSessionProgress, MirrorCharacterPage } from "./features/mirror-character";
import { SettingsPage } from "./features/settings";

type View = "home" | "sessions" | "insights" | "character" | "settings";

const navigation: Array<{ id: View; label: string; icon: IconName }> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "sessions", label: "Focus Sessions", icon: "clock" },
  { id: "insights", label: "Insights", icon: "insights" },
  { id: "character", label: "Mirror Character", icon: "character" },
  { id: "settings", label: "Settings", icon: "settings" }
];

const idleState: SessionState = {
  status: "idle",
  sessionId: null,
  config: null,
  startedAt: null,
  eventCount: 0,
  error: null
};

export function App(): React.JSX.Element {
  const [activeView, setActiveView] = useState<View>("home");
  const [goal, setGoal] = useState("Finish the product presentation");
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [session, setSession] = useState<SessionState>(idleState);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = window.mirror;
    if (!api) {
      setError("Desktop bridge is unavailable. Restart Mirror from the Electron app.");
      return undefined;
    }

    void api.getSessionState().then(setSession).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Unable to read session state");
    });
    return api.onSessionStateChanged(setSession);
  }, []);

  const isActive = ["starting", "running", "stopping"].includes(session.status);
  const statusLabel = useMemo(
    () => session.status.charAt(0).toUpperCase() + session.status.slice(1),
    [session.status]
  );
  const statusTone: BadgeTone = session.status === "running"
    ? "success"
    : session.status === "failed"
      ? "danger"
      : ["starting", "stopping"].includes(session.status)
        ? "warning"
        : "neutral";

  const toggleSession = async (): Promise<void> => {
    setError(null);
    try {
      const api = window.mirror;
      if (!api) throw new Error("Desktop bridge is unavailable");

      if (session.status === "running") {
        await api.stopSession();
      } else {
        await api.startSession({
          goal,
          durationMinutes,
          captureScreenshots: false
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the session");
    }
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <span className="brand-name">Mirror</span>
        </div>

        <nav className="navigation" aria-label="Main navigation">
          {navigation.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              size="md"
              icon={item.icon}
              className={activeView === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setActiveView(item.id)}
              aria-current={activeView === item.id ? "page" : undefined}
              title={item.label}
            >
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="avatar">DA</span>
          <div>
            <strong>Denis</strong>
            <span>Personal workspace</span>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="workspace-label">WORKSPACE</p>
            <strong>{navigation.find((item) => item.id === activeView)?.label}</strong>
          </div>
        <Badge tone={statusTone} dot>
          {statusLabel}
        </Badge>
      </header>

        {activeView === "home" ? (
          <div className="page-content">
            <section className="hero">
              <Eyebrow>YOUR NEXT FOCUS SESSION</Eyebrow>
              <Heading>What will you finish?</Heading>
              <Text size="lg" className="subtitle">
                Set one clear outcome. Mirror will understand how the work unfolds.
              </Text>
            </section>

            <Surface as="section" className="session-card">
              <Field label="Session goal" htmlFor="goal">
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
                <Field className="duration" label="Duration" htmlFor="duration">
                  <Select
                    id="duration"
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(Number(event.target.value))}
                    disabled={isActive}
                  >
                    {[25, 45, 60, 90, 120].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} min
                      </option>
                    ))}
                  </Select>
                </Field>

                <Button
                  type="button"
                  size="lg"
                  variant={session.status === "running" ? "danger" : "primary"}
                  icon={session.status === "running" ? "stop" : "play"}
                  loading={session.status === "starting" || session.status === "stopping"}
                  className="session-action"
                  onClick={() => void toggleSession()}
                  disabled={!window.mirror}
                >
                  {session.status === "running" ? "Finish session" : "Start focus session"}
                </Button>
              </div>

              {error ? (
                <p className="session-error" role="alert">
                  <Icon name="alert" />
                  {error}
                </p>
              ) : null}
            </Surface>

            <section className="metrics" aria-label="Live session signals">
              <Surface as="article" variant="subtle">
                <span>Captured signals</span>
                <strong>{session.eventCount}</strong>
              </Surface>
              <Surface as="article" variant="subtle">
                <span>Privacy mode</span>
                <strong>On</strong>
              </Surface>
              <Surface as="article" variant="subtle">
                <span>Analysis</span>
                <strong>After session</strong>
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
              <Icon name={navigation.find((item) => item.id === activeView)?.icon ?? "home"} size={20} />
            </span>
            <Eyebrow>MIRROR WORKSPACE</Eyebrow>
            <Heading size="title">{navigation.find((item) => item.id === activeView)?.label}</Heading>
            <Text>This space is ready for the next part of your Mirror experience.</Text>
          </section>
        )}
      </div>
    </main>
  );
}
