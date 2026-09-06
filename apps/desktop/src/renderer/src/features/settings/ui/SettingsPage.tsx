import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_PRIVACY_SETTINGS,
  type InstalledApplication,
  type PrivacySettings,
} from "@mirror/contracts";
import { LanguageSwitcher } from "../../../shared/i18n";
import {
  Button,
  Eyebrow,
  Field,
  Heading,
  Input,
  Surface,
  Text,
  Textarea,
} from "../../../shared/ui";
import "./styles.css";

type ListSetting =
  | "blockedApplications"
  | "blockedWindowTitleKeywords"
  | "blockedDomains";

const toLines = (items: readonly string[]): string => items.join("\n");

const fromLines = (value: string): string[] => [
  ...new Set(
    value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  ),
];

export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation("settings");

  const [settings, setSettings] = useState<PrivacySettings>(
    DEFAULT_PRIVACY_SETTINGS,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [applications, setApplications] = useState<InstalledApplication[]>([]);
  const [applicationSearch, setApplicationSearch] = useState("");
  const [loadingApplications, setLoadingApplications] = useState(true);

  useEffect(() => {
    const api = window.mirror;
    if (!api) return;

    void api
      .getPrivacySettings()
      .then(setSettings)
      .catch(() => setMessage(t("privacy.messages.loadError")));
    if (typeof api.listApplications === "function") {
      void api
        .listApplications()
        .then(setApplications)
        .catch(() => setMessage(t("privacy.messages.applicationLoadError")))
        .finally(() => setLoadingApplications(false));
    } else {
      setLoadingApplications(false);
      setMessage(t("privacy.messages.restartRequired"));
    }
  }, []);

  const visibleApplications = applications.filter((application) => {
    const search = applicationSearch.trim().toLocaleLowerCase();
    return !search || application.name.toLocaleLowerCase().includes(search) ||
      application.bundleIdentifier?.toLocaleLowerCase().includes(search);
  });

  const applicationIdentity = (application: InstalledApplication): string =>
    application.bundleIdentifier ?? application.name;

  const toggleApplication = (application: InstalledApplication): void => {
    const identity = applicationIdentity(application);
    setSettings((current) => ({
      ...current,
      blockedApplications: current.blockedApplications.includes(identity)
        ? current.blockedApplications.filter((item) => item !== identity)
        : [...current.blockedApplications, identity]
    }));
    setMessage(null);
  };

  const updateList = (key: ListSetting, value: string): void => {
    setSettings((current) => ({
      ...current,
      [key]: fromLines(value),
    }));

    setMessage(null);
  };

  const save = async (): Promise<void> => {
    const api = window.mirror;
    if (!api) return;

    setSaving(true);
    setMessage(null);

    try {
      setSettings(await api.savePrivacySettings(settings));
      setMessage(t("privacy.messages.saved"));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("privacy.messages.saveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <Eyebrow>{t("header.eyebrow")}</Eyebrow>

        <Heading size="title">{t("header.title")}</Heading>

        <Text size="lg">{t("header.description")}</Text>
      </header>

      <Surface
        as="section"
        className="settings-section"
        aria-labelledby="language-settings-title"
      >
        <div className="settings-section__copy">
          <Heading level={2} size="section" id="language-settings-title">
            {t("language.title")}
          </Heading>

          <Text>{t("language.description")}</Text>
        </div>

        <LanguageSwitcher />
      </Surface>

      <Surface
        as="section"
        className="settings-section privacy-section"
        aria-labelledby="privacy-settings-title"
      >
        <div className="settings-section__copy">
          <Heading level={2} size="section" id="privacy-settings-title">
            {t("privacy.title")}
          </Heading>

          <Text>{t("privacy.description")}</Text>
        </div>

        <div className="privacy-fields">
          <Field
            label={t("privacy.blockedApplications.label")}
            htmlFor="blocked-applications"
            hint={t("privacy.blockedApplications.hint")}
          >
            <Input
              id="blocked-applications"
              type="search"
              value={applicationSearch}
              onChange={(event) => setApplicationSearch(event.target.value)}
              placeholder={t("privacy.blockedApplications.placeholder")}
            />
            <div className="application-picker" role="list" aria-busy={loadingApplications}>
              {loadingApplications ? (
                <p>{t("privacy.blockedApplications.loading")}</p>
              ) : visibleApplications.length === 0 ? (
                <p>{t("privacy.blockedApplications.empty")}</p>
              ) : visibleApplications.map((application) => {
                const identity = applicationIdentity(application);
                return (
                  <label className="application-option" key={identity}>
                    <input
                      type="checkbox"
                      checked={settings.blockedApplications.includes(identity)}
                      onChange={() => toggleApplication(application)}
                    />
                    <span>
                      <strong>{application.name}</strong>
                      {application.bundleIdentifier ? <small>{application.bundleIdentifier}</small> : null}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="application-picker__selected">
              {t("privacy.blockedApplications.selected", {
                count: settings.blockedApplications.length
              })}
            </p>
          </Field>

          <Field
            label={t("privacy.blockedWindowTitles.label")}
            htmlFor="blocked-window-titles"
            hint={t("privacy.blockedWindowTitles.hint")}
          >
            <Textarea
              id="blocked-window-titles"
              rows={4}
              value={toLines(settings.blockedWindowTitleKeywords)}
              onChange={(event) =>
                updateList("blockedWindowTitleKeywords", event.target.value)
              }
              placeholder={t("privacy.blockedWindowTitles.placeholder")}
            />
          </Field>

          <Field
            label={t("privacy.blockedDomains.label")}
            htmlFor="blocked-domains"
            hint={t("privacy.blockedDomains.hint")}
          >
            <Textarea
              id="blocked-domains"
              rows={3}
              value={toLines(settings.blockedDomains)}
              onChange={(event) =>
                updateList("blockedDomains", event.target.value)
              }
              placeholder={t("privacy.blockedDomains.placeholder")}
            />
          </Field>

          <label className="privacy-toggle">
            <input
              type="checkbox"
              checked={settings.captureWindowTitles}
              onChange={(event) => {
                setSettings((current) => ({
                  ...current,
                  captureWindowTitles: event.target.checked,
                }));

                setMessage(null);
              }}
            />

            <span>
              <strong>{t("privacy.captureWindowTitles.label")}</strong>

              <small>{t("privacy.captureWindowTitles.description")}</small>
            </span>
          </label>

          <div className="privacy-actions">
            {message ? <p role="status">{message}</p> : <span />}

            <Button
              type="button"
              onClick={() => void save()}
              loading={saving}
              disabled={!window.mirror}
            >
              {t("privacy.save")}
            </Button>
          </div>
        </div>
      </Surface>
    </div>
  );
}
