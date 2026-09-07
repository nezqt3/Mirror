import { useTranslation } from "react-i18next";
import { Badge, Eyebrow, Heading, Icon, Surface, Text } from "../../../shared/ui";
import { mockFocusSessions } from "../model/mockSessions";
import "./styles.css";

export function SessionsPage(): React.JSX.Element {
  const { t, i18n } = useTranslation("focus");
  const totalMinutes = mockFocusSessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const averageScore = Math.round(
    mockFocusSessions.reduce((sum, session) => sum + session.focusScore, 0) / mockFocusSessions.length
  );

  return (
    <div className="sessions-page">
      <header className="feature-header">
        <div><Eyebrow>{t("history.eyebrow")}</Eyebrow><Heading size="title">{t("history.title")}</Heading><Text size="lg">{t("history.description")}</Text></div>
        <Badge tone="accent"><Icon name="sparkles" />{t("history.localData")}</Badge>
      </header>
      <section className="history-summary">
        <Surface variant="subtle"><span>{t("history.totalTime")}</span><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong></Surface>
        <Surface variant="subtle"><span>{t("history.averageFocus")}</span><strong>{averageScore}</strong></Surface>
        <Surface variant="subtle"><span>{t("history.sessions")}</span><strong>{mockFocusSessions.length}</strong></Surface>
      </section>
      <Surface as="section" className="session-list">
        <div className="session-list__header"><Heading level={2} size="section">{t("history.recent")}</Heading><span>{t("history.mockLabel")}</span></div>
        {mockFocusSessions.map((session) => (
          <article className="session-row" key={session.id}>
            <div className="session-row__icon"><Icon name={session.status === "completed" ? "check" : "clock"} /></div>
            <div className="session-row__goal"><strong>{session.goal}</strong><span>{new Intl.DateTimeFormat(i18n.language, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(session.startedAt))}</span></div>
            <div><span>{t("history.duration")}</span><strong>{t("session.minutes", { minutes: session.durationMinutes })}</strong></div>
            <div><span>{t("history.focusScore")}</span><strong className="session-row__score">{session.focusScore}</strong></div>
            <div><span>{t("history.switches")}</span><strong>{session.contextSwitches}</strong></div>
          </article>
        ))}
      </Surface>
    </div>
  );
}
