import { useTranslation } from "react-i18next";
import { Button, Field, Icon, Select, Surface, Textarea } from "../../../shared/ui";
import type { FocusSessionController } from "../model/useFocusSession";
import { FocusTimerHero } from "./FocusTimerHero";
import "./styles.css";

export interface FocusSessionPageProps {
  controller: FocusSessionController;
}

export function FocusSessionPage({ controller }: FocusSessionPageProps): React.JSX.Element {
  const { t } = useTranslation("focus");
  const { session, isActive } = controller;

  return (
    <div className="focus-page">
      <FocusTimerHero
        remainingLabel={controller.remainingLabel}
        progress={controller.progress}
        isActive={isActive}
        goal={controller.goal}
      />

      <Surface as="section" className={`focus-console ${isActive ? "focus-console--active" : ""}`}>
        <Field label={t("session.goal")} htmlFor="focus-goal">
          <Textarea
            id="focus-goal"
            value={controller.goal}
            onChange={(event) => controller.setGoal(event.target.value)}
            disabled={isActive}
            maxLength={500}
            rows={isActive ? 1 : 2}
          />
        </Field>
        <div className="focus-console__actions">
          <Field label={t("session.duration")} htmlFor="focus-duration">
            <Select
              id="focus-duration"
              value={controller.durationMinutes}
              onChange={(event) => controller.setDurationMinutes(Number(event.target.value))}
              disabled={isActive}
            >
              {controller.durations.map((minutes) => (
                <option key={minutes} value={minutes}>{t("session.minutes", { minutes })}</option>
              ))}
            </Select>
          </Field>
          <Button
            type="button"
            size="lg"
            variant={session.status === "running" ? "danger" : "primary"}
            icon={session.status === "running" ? "stop" : "play"}
            loading={session.status === "starting" || session.status === "stopping"}
            onClick={() => void controller.toggle()}
            disabled={!window.mirror}
          >
            {session.status === "running" ? t("session.finish") : t("session.start")}
          </Button>
        </div>
        {controller.error ? (
          <p className="focus-console__error" role="alert"><Icon name="alert" />{controller.error}</p>
        ) : null}
      </Surface>

      <section className="focus-signals" aria-label={t("signals.ariaLabel")}>
        <div><span>{t("signals.captured")}</span><strong>{session.eventCount}</strong></div>
        <div><span>{t("signals.privacy")}</span><strong className="focus-signals__safe">{t("signals.protected")}</strong></div>
        <div><span>{t("signals.character")}</span><strong>{isActive ? t("signals.withYou") : t("signals.ready")}</strong></div>
      </section>
    </div>
  );
}
