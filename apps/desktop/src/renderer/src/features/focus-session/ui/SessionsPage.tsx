import { useTranslation } from "react-i18next";
import { Badge, Button, Eyebrow, Heading, Icon, Surface, Text } from "../../../shared/ui";
import { useSessionHistory } from "../model/useSessionHistory";
import "./styles.css";

export function SessionsPage(): React.JSX.Element {
  const { t, i18n } = useTranslation("focus");
  const { sessions, isLoading, error, reload, retryAnalysis } = useSessionHistory();
  const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const scores = sessions.flatMap((session) => session.focusScore === null ? [] : [session.focusScore]);
  const averageScore = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : 0;

  return (
    <div className="sessions-page">
      <header className="feature-header">
        <div><Eyebrow>{t("history.eyebrow")}</Eyebrow><Heading size="title">{t("history.title")}</Heading><Text size="lg">{t("history.description")}</Text></div>
        <Badge tone="accent"><Icon name="sparkles" />{t("history.serverData")}</Badge>
      </header>
      <section className="history-summary">
        <Surface variant="subtle"><span>{t("history.totalTime")}</span><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong></Surface>
        <Surface variant="subtle"><span>{t("history.averageFocus")}</span><strong>{averageScore}</strong></Surface>
        <Surface variant="subtle"><span>{t("history.sessions")}</span><strong>{sessions.length}</strong></Surface>
      </section>
      <Surface as="section" className="session-list">
        <div className="session-list__header"><Heading level={2} size="section">{t("history.recent")}</Heading><span>{t("history.liveLabel")}</span></div>
        {isLoading && <Text tone="secondary">{t("history.loading")}</Text>}
        {error && (
          <div className="session-list__state" role="alert">
            <Text tone="secondary">{error.message}</Text>
            <Button type="button" variant="secondary" onClick={() => void reload()}>{t("history.retry")}</Button>
          </div>
        )}
        {!isLoading && !error && sessions.length === 0 && (
          <Text tone="secondary">{t("history.empty")}</Text>
        )}
        {sessions.map((session) => (
          <article className="session-row" key={session.id}>
            <div className="session-row__icon"><Icon name={session.status === "completed" ? "check" : "clock"} /></div>
            <div className="session-row__goal"><strong>{session.goal}</strong><span>{new Intl.DateTimeFormat(i18n.language, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(session.startedAt))}</span></div>
            <div><span>{t("history.duration")}</span><strong>{t("session.minutes", { minutes: session.durationMinutes })}</strong></div>
            <div><span>{t("history.focusScore")}</span><strong className="session-row__score">{session.focusScore ?? "—"}</strong></div>
            <div>
              <span>{t("history.switches")}</span>
              <strong>{session.contextSwitches ?? "—"}</strong>
              {session.report?.status === "failed" && session.report.can_retry && (
                <Button type="button" variant="ghost" size="sm" onClick={() => void retryAnalysis(session.id)}>
                  {t("history.retryAnalysis")}
                </Button>
              )}
            </div>
            {session.report?.status === "completed" && (
              <details className="session-report">
                <summary>{t("history.report.open")}</summary>
                <div className="session-report__metrics">
                  <div><span>{t("history.report.goalCompletion")}</span><strong>{session.report.goal_completion === null ? "—" : String(Math.round(session.report.goal_completion)) + "%"}</strong></div>
                  <div><span>{t("history.report.deepWork")}</span><strong>{t("session.minutes", { minutes: session.report.deep_work_minutes })}</strong></div>
                  <div><span>{t("history.report.xp")}</span><strong>+{session.report.rewards.xp} XP</strong></div>
                </div>
                {session.report.main_bottleneck && (
                  <section>
                    <strong>{t("history.report.bottleneck")}</strong>
                    <p>{session.report.main_bottleneck}</p>
                  </section>
                )}
                {session.report.distractions.length > 0 && (
                  <section>
                    <strong>{t("history.report.distractions")}</strong>
                    <ul>{session.report.distractions.map((item) => <li key={item}>{item}</li>)}</ul>
                  </section>
                )}
                {session.report.insights.length > 0 && (
                  <section>
                    <strong>{t("history.report.insights")}</strong>
                    <ul>{session.report.insights.map((item) => <li key={item}>{item}</li>)}</ul>
                  </section>
                )}
                {session.report.next_session_advice && (
                  <section>
                    <strong>{t("history.report.advice")}</strong>
                    <p>{session.report.next_session_advice}</p>
                  </section>
                )}
              </details>
            )}
          </article>
        ))}
      </Surface>
    </div>
  );
}
