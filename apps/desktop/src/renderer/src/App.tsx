import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnalyticsPage } from "./features/analytics";
import { AuthPage, useAuth, type User } from "./features/auth";
import {
  FocusSessionPage,
  SessionsPage,
  useFocusSession
} from "./features/focus-session";
import {
  CharacterPageContainer
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
  const auth = useAuth();

  if (auth.isLoading) {
    return <main className="auth-loading" aria-label="Loading"><span /></main>;
  }

  if (!auth.user) {
    return <AuthPage onLogin={auth.login} onRegister={auth.register} />;
  }

  return <Workspace user={auth.user} onLogout={auth.logout} />;
}

interface WorkspaceProps {
  user: User;
  onLogout: () => Promise<void>;
}

function Workspace({ user, onLogout }: WorkspaceProps): React.JSX.Element {
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
  const initials = user.display_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || user.email[0]?.toUpperCase() || "M";

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
          <span className="avatar">{initials}</span>
          <div><strong>{user.display_name}</strong><span>{user.email}</span></div>
          <button className="sidebar-logout" type="button" onClick={() => void onLogout()} title={t("auth.logout")}>
            {t("auth.logout")}
          </button>
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
          <CharacterPageContainer />
        ) : (
          <SettingsPage />
        )}
      </div>
    </main>
  );
}
