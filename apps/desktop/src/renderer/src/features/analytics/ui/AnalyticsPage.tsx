import { useTranslation } from "react-i18next";
import { Badge, Eyebrow, Heading, Icon, Surface, Text } from "../../../shared/ui";
import { mockAnalytics } from "../model/mockAnalytics";
import "./styles.css";

export function AnalyticsPage(): React.JSX.Element {
  const { t } = useTranslation("analytics");
  const maxMinutes = Math.max(...mockAnalytics.weekly.map((day) => day.minutes));

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <div><Eyebrow>{t("header.eyebrow")}</Eyebrow><Heading size="title">{t("header.title")}</Heading><Text size="lg">{t("header.description")}</Text></div>
        <Badge tone="accent"><Icon name="sparkles" />{t("header.mockData")}</Badge>
      </header>

      <section className="analytics-grid">
        <Surface as="article" className="focus-score-card">
          <div className="score-orb" style={{ "--score": `${mockAnalytics.focusScore * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{mockAnalytics.focusScore}</strong><span>/ 100</span></div>
          </div>
          <div><Eyebrow>{t("score.eyebrow")}</Eyebrow><Heading level={2} size="section">{t("score.title")}</Heading><Text>{t("score.description")}</Text><span className="score-trend"><Icon name="bolt" />{t("score.trend")}</span></div>
        </Surface>

        <Surface as="article" className="weekly-card">
          <div className="analytics-card-heading"><div><Eyebrow>{t("weekly.eyebrow")}</Eyebrow><Heading level={2} size="section">{t("weekly.title")}</Heading></div><strong>{mockAnalytics.deepWorkMinutes} min</strong></div>
          <div className="weekly-chart" aria-label={t("weekly.ariaLabel")}>
            {mockAnalytics.weekly.map((day) => (
              <div className="weekly-bar" key={day.day}>
                <span className="weekly-bar__value">{day.minutes}</span>
                <div><i style={{ height: `${Math.max(12, (day.minutes / maxMinutes) * 100)}%` }} /></div>
                <span>{t(`days.${day.day}`)}</span>
              </div>
            ))}
          </div>
        </Surface>
      </section>

      <section className="analytics-kpis">
        <Surface variant="subtle"><span>{t("kpis.deepWork")}</span><strong>{mockAnalytics.deepWorkMinutes}</strong><small>{t("kpis.minutes")}</small></Surface>
        <Surface variant="subtle"><span>{t("kpis.sessions")}</span><strong>{mockAnalytics.sessionsCompleted}</strong><small>{t("kpis.completed")}</small></Surface>
        <Surface variant="subtle"><span>{t("kpis.switches")}</span><strong>{mockAnalytics.contextSwitches}</strong><small>{t("kpis.contexts")}</small></Surface>
      </section>

      <section className="insight-grid">
        <Surface as="article" className="insight-card insight-card--primary"><span className="insight-card__icon"><Icon name="sparkles" /></span><div><Eyebrow>{t("insights.pattern.eyebrow")}</Eyebrow><Heading level={2} size="section">{t("insights.pattern.title")}</Heading><Text>{t("insights.pattern.description")}</Text></div></Surface>
        <Surface as="article" className="insight-card"><span className="insight-card__icon"><Icon name="target" /></span><div><Eyebrow>{t("insights.next.eyebrow")}</Eyebrow><Heading level={2} size="section">{t("insights.next.title")}</Heading><Text>{t("insights.next.description")}</Text></div></Surface>
      </section>
    </div>
  );
}
