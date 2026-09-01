import { useEffect, useMemo, useState } from "react";
import type { SessionState } from "@mirror/contracts";

const idleState: SessionState = {
  status: "idle",
  sessionId: null,
  config: null,
  startedAt: null,
  eventCount: 0,
  error: null
};

export function App(): React.JSX.Element {
  const [goal, setGoal] = useState("Finish the Mirror presentation");
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
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <span>Mirror</span>
        </div>
        <div className={`status status-${session.status}`}>
          <span className="status-dot" />
          {statusLabel}
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">YOUR NEXT FOCUS SESSION</p>
        <h1>What will you finish?</h1>
        <p className="subtitle">
          Set one clear outcome. Mirror will understand how the work unfolds.
        </p>
      </section>

      <section className="session-card">
        <label htmlFor="goal">Session goal</label>
        <textarea
          id="goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          disabled={isActive}
          maxLength={500}
          rows={3}
        />

        <div className="controls">
          <label className="duration" htmlFor="duration">
            <span>Duration</span>
            <select
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
            </select>
          </label>

          <button
            type="button"
            className={session.status === "running" ? "stop" : "start"}
            onClick={() => void toggleSession()}
            disabled={
              !window.mirror || session.status === "starting" || session.status === "stopping"
            }
          >
            {session.status === "running" ? "Finish session" : "Start focus session"}
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="metrics" aria-label="Live session signals">
        <article>
          <span>Captured signals</span>
          <strong>{session.eventCount}</strong>
        </article>
        <article>
          <span>Privacy mode</span>
          <strong>On</strong>
        </article>
        <article>
          <span>Analysis</span>
          <strong>After session</strong>
        </article>
      </section>
    </main>
  );
}
