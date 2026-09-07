import { useTranslation } from "react-i18next";
import { MirrorAvatar } from "../../mirror-character";

export interface FocusTimerHeroProps {
  remainingLabel: string;
  progress: number;
  isActive: boolean;
  goal: string;
}

export function FocusTimerHero({
  remainingLabel,
  progress,
  isActive,
  goal
}: FocusTimerHeroProps): React.JSX.Element {
  const { t } = useTranslation("focus");
  const radius = 174;
  const circumference = 2 * Math.PI * radius;

  return (
    <section className={`focus-timer ${isActive ? "focus-timer--active" : ""}`}>
      <div className="focus-timer__ambient" aria-hidden="true" />
      <div className="focus-timer__orbit">
        <svg className="focus-timer__ring" viewBox="0 0 380 380" aria-hidden="true">
          <defs>
            <linearGradient id="focus-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#b6a7ff" />
              <stop offset="0.55" stopColor="#7c63e8" />
              <stop offset="1" stopColor="#45dfa0" />
            </linearGradient>
          </defs>
          <circle className="focus-timer__track" cx="190" cy="190" r={radius} />
          <circle
            className="focus-timer__progress"
            cx="190"
            cy="190"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>
        <span className="focus-timer__satellite focus-timer__satellite--one" />
        <span className="focus-timer__satellite focus-timer__satellite--two" />
        <div className="focus-timer__avatar">
          <MirrorAvatar />
        </div>
        <div className="focus-timer__time" aria-live="polite">
          <span>{isActive ? t("timer.remaining") : t("timer.ready")}</span>
          <strong>{remainingLabel}</strong>
        </div>
      </div>
      <div className="focus-timer__copy">
        <span className="focus-timer__presence">
          <i /> {isActive ? t("timer.characterActive") : t("timer.characterReady")}
        </span>
        <h1>{isActive ? goal : t("hero.title")}</h1>
        <p>{isActive ? t("timer.activeDescription") : t("hero.description")}</p>
      </div>
    </section>
  );
}
