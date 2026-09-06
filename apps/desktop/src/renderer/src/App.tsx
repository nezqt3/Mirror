import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnalyticsPage } from "./features/analytics";
import {
  FocusSessionPage,
  SessionsPage,
  useFocusSession
} from "./features/focus-session";
import {
  baseMirrorCharacter,
  characterSessionProgress,
  MirrorCharacterPage
} from "./features/mirror-character";
import { SettingsPage } from "./features/settings";
import { Badge, Button, type BadgeTone, type IconName } from "./shared/ui";
import mirrorAvatar from "./assets/mirror-avatar.png";

type View = "home" | "sessions" | "insights" | "character" | "settings";

const navigation: Array<{ id: View; icon: IconName }> = [
  { id: "home", icon: "home" },
  { id: "sessions", icon: "clock" },
  { id: "insights", icon: "insights" },
  { id: "character", icon: "character" },
  { id: "settings", icon: "settings" }
];

export function App(): React.JSX.Element {
  const { t } = useTranslation("app");
  const [activeView, setActiveView] = useState<View>("home");
  const focus = useFocusSession();
  const activeNavigationItem = navigation.find((item) => item.id === activeView);
  const statusLabel = useMemo(
    () => t(`status.${focus.session.status}`),
    [focus.session.status, t]
  );
  const statusTone: BadgeTone = focus.session.status === "running"
    ? "success"
    : focus.session.status === "failed"
      ? "danger"
      : ["starting", "stopping"].includes(focus.session.status)
        ? "warning"
        : "neutral";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><img src={mirrorAvatar} alt="" /></span>
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
                className={activeView === item.id ? "nav-item active" : "nav-item"}
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
          <div><strong>Denis</strong><span>{t("sidebar.workspace")}</span></div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="workspace-label">{t("topbar.workspace")}</p>
            <strong>{activeNavigationItem ? t(`navigation.${activeNavigationItem.id}`) : ""}</strong>
          </div>
          <Badge tone={statusTone} dot>{statusLabel}</Badge>
        </header>

        {activeView === "home" ? (
          <FocusSessionPage controller={focus} />
        ) : activeView === "sessions" ? (
          <SessionsPage />
        ) : activeView === "insights" ? (
          <AnalyticsPage />
        ) : activeView === "character" ? (
          <MirrorCharacterPage
            character={baseMirrorCharacter}
            latestProgress={characterSessionProgress}
          />
        ) : (
          <SettingsPage />
        )}
      </div>
    </main>
  );
}
