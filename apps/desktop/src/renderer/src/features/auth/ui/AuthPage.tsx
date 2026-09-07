import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../shared/api";
import { LanguageSwitcher } from "../../../shared/i18n";
import { AutoField, Button, Heading, Text } from "../../../shared/ui";
import mirrorAvatar from "../../../assets/mirror-avatar.png";
import type { LoginPayload, RegisterPayload } from "../api/authApi";
import "./styles.css";

interface AuthPageProps {
  onLogin: (payload: LoginPayload) => Promise<void>;
  onRegister: (payload: RegisterPayload) => Promise<void>;
}

export function AuthPage({ onLogin, onRegister }: AuthPageProps): React.JSX.Element {
  const { t } = useTranslation("app");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const switchMode = () => {
    setMode((current) => current === "login" ? "register" : "login");
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);

    try {
      const credentials = {
        email: String(data.get("email") ?? "").trim(),
        password: String(data.get("password") ?? "")
      };
      if (mode === "register") {
        await onRegister({ ...credentials, display_name: String(data.get("display_name") ?? "").trim() });
      } else {
        await onLogin(credentials);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(t("auth.errors.unknown")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const errorMessage = error?.code === "NETWORK_ERROR"
    ? t("auth.errors.network")
    : error?.code === "UNAUTHORIZED"
      ? t("auth.errors.credentials")
      : error?.code === "CONFLICT"
        ? t("auth.errors.exists")
        : error?.code === "VALIDATION_ERROR"
          ? t("auth.errors.validation")
        : error?.message;

  return (
    <main className="auth-page">
      <div className="auth-language">
        <LanguageSwitcher label={t("auth.language")} />
      </div>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="auth-brand__mark"><img src={mirrorAvatar} alt="" /></span>
          <span>Mirror</span>
        </div>
        <div className="auth-card__intro">
          <Heading id="auth-title" level={1} size="section">
            {t(`auth.${mode}.title`)}
          </Heading>
          <Text tone="secondary">{t(`auth.${mode}.description`)}</Text>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <AutoField
              name="display_name"
              label={t("auth.fields.name")}
              autoComplete="name"
              required
              minLength={1}
              maxLength={120}
              error={error?.fieldErrors.display_name}
            />
          )}
          <AutoField
            name="email"
            type="email"
            label={t("auth.fields.email")}
            autoComplete="email"
            required
            error={error?.fieldErrors.email}
          />
          <AutoField
            name="password"
            type="password"
            label={t("auth.fields.password")}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "register" ? 8 : undefined}
            maxLength={128}
            hint={mode === "register" ? t("auth.fields.passwordHint") : undefined}
            error={error?.fieldErrors.password}
          />

          {errorMessage && <div className="auth-error" role="alert">{errorMessage}</div>}
          <Button className="auth-submit" type="submit" size="lg" loading={isSubmitting}>
            {t(`auth.${mode}.submit`)}
          </Button>
        </form>

        <button className="auth-switch" type="button" onClick={switchMode} disabled={isSubmitting}>
          {t(`auth.${mode}.switch`)}
        </button>
      </section>
    </main>
  );
}
