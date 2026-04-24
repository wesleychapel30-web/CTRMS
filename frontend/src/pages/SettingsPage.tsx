import { Bell, Building2, Mail, Palette, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { InlineBanner, StatePanel } from "../components/FeedbackStates";
import { SectionCard } from "../components/SectionCard";
import { changeOwnPassword, fetchSystemSettings, resolveAssetUrl, sendInvitationReminders, sendTestEmail, updateSystemSettings, uploadOrganizationAssets } from "../lib/api";
import { useSession } from "../context/SessionContext";
import { useToast } from "../context/ToastContext";
import type { SettingsOverview } from "../types";

type AssetUploadResponse = Awaited<ReturnType<typeof uploadOrganizationAssets>>;
type SettingsResponse = Awaited<ReturnType<typeof fetchSystemSettings>>;
type TestEmailResponse = Awaited<ReturnType<typeof sendTestEmail>>;
type ReminderResponse = Awaited<ReturnType<typeof sendInvitationReminders>>;
type SettingsTab = "branding" | "organization" | "notifications" | "smtp" | "access";

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Request failed";
}

const tabs: Array<{ key: SettingsTab; label: string; icon: typeof Palette }> = [
  { key: "branding", label: "Branding", icon: Palette },
  { key: "organization", label: "Organization Profile", icon: Building2 },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "smtp", label: "SMTP / Email Settings", icon: Mail },
  { key: "access", label: "Access Control", icon: ShieldCheck }
];

export function SettingsPage() {
  const { user, hasPermission, refresh } = useSession();
  const toast = useToast();
  const [settings, setSettings] = useState<SettingsOverview | null>(null);
  const [draft, setDraft] = useState<SettingsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("branding");

  const isAdmin = hasPermission("settings:update");
  const canChangePassword = hasPermission("profile:change_password");

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    fetchSystemSettings()
      .then((data: SettingsResponse) => {
        setSettings(data);
        setDraft(data);
        setTestEmailRecipient(
          data.system_settings.sender_email || data.system_settings.support_email || user?.email || ""
        );
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [user?.email, isAdmin]);

  if (!isAdmin && !canChangePassword) {
    return <StatePanel variant="info" title="Settings restricted" message="You do not have permission to access this page." />;
  }

  if (isAdmin && !settings) {
    if (error) {
      return <StatePanel variant="error" title="Settings unavailable" message={error} />;
    }
    return <StatePanel variant="loading" title="Loading settings" message="Loading branding, email, and access settings." />;
  }

  const current = (draft ?? settings) as SettingsOverview;
  const forcePasswordChange = Boolean(user?.force_password_change);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      toast.error("New password and confirmation do not match.");
      return;
    }
    setIsChangingPassword(true);
    setError(null);
    try {
      await changeOwnPassword({ current_password: currentPassword, new_password: newPassword });
      await refresh();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully.");
    } catch (reason: unknown) {
      const message = getErrorMessage(reason);
      setError(message);
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!isAdmin) {
    return (
      <SectionCard title="Access Control" subtitle="Update your account password.">
        {error ? <InlineBanner variant="error" title="Password update failed" message={error} className="mb-3" /> : null}
        {forcePasswordChange ? (
          <InlineBanner
            variant="warning"
            title="Password update required"
            message="Password change is required before continuing."
            className="mb-3"
          />
        ) : null}
        <PasswordPanel
          currentPassword={currentPassword}
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          isChangingPassword={isChangingPassword}
          onCurrentPasswordChange={setCurrentPassword}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={() => void handlePasswordChange()}
        />
      </SectionCard>
    );
  }

  const saveSettings = async () => {
    if (!draft) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const data = await updateSystemSettings(draft);
      setSettings(data);
      setDraft(data);
      toast.success("Settings saved.");
    } catch (reason: unknown) {
      const message = getErrorMessage(reason);
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const discardChanges = () => {
    if (!settings) {
      return;
    }
    setDraft(settings);
    setError(null);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="surface-panel rounded-xl p-4">
          <h2 className="headline-font text-base font-bold tracking-[-0.03em] text-[var(--ink)]">Settings</h2>
        </div>

        <div className="space-y-1 rounded-xl bg-[var(--surface-low)] p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`institutional-tab w-full ${activeTab === tab.key ? "institutional-tab-active" : ""}`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="space-y-4">
        {error ? <InlineBanner variant="error" title="Settings update failed" message={error} /> : null}

        {activeTab === "branding" ? (
          <div className="space-y-4">
            <section className="surface-panel rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-kicker">Visual Identity</p>
                  <h3 className="headline-font mt-1.5 text-base font-bold tracking-[-0.03em] text-[var(--ink)]">Logo, favicon, and banner assets</h3>
                </div>
                <span className="rounded-sm bg-[var(--surface-low)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Branding
                </span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <AssetTile label="Institutional Logo" url={current.organization_settings.logo_url} />
                <AssetTile label="Favicon" url={current.organization_settings.favicon_url} />
                <AssetTile label="Banner" url={current.organization_settings.banner_url} />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <UploadField
                  label="Upload logo"
                  disabled={isUploading}
                  onFileSelect={(file) =>
                    (async () => {
                      setIsUploading(true);
                      try {
                        const res: AssetUploadResponse = await uploadOrganizationAssets({ logo: file });
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                organization_settings: { ...prev.organization_settings, logo_url: res.organization_settings.logo_url }
                              }
                            : prev
                        );
                        toast.success("Logo uploaded.");
                      } catch (reason: unknown) {
                        const message = getErrorMessage(reason);
                        setError(message);
                        toast.error(message);
                      } finally {
                        setIsUploading(false);
                      }
                    })()
                  }
                />
                <UploadField
                  label="Upload favicon"
                  disabled={isUploading}
                  onFileSelect={(file) =>
                    (async () => {
                      setIsUploading(true);
                      try {
                        const res: AssetUploadResponse = await uploadOrganizationAssets({ favicon: file });
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                organization_settings: { ...prev.organization_settings, favicon_url: res.organization_settings.favicon_url }
                              }
                            : prev
                        );
                        toast.success("Favicon uploaded.");
                      } catch (reason: unknown) {
                        const message = getErrorMessage(reason);
                        setError(message);
                        toast.error(message);
                      } finally {
                        setIsUploading(false);
                      }
                    })()
                  }
                />
                <UploadField
                  label="Upload banner"
                  disabled={isUploading}
                  onFileSelect={(file) =>
                    (async () => {
                      setIsUploading(true);
                      try {
                        const res: AssetUploadResponse = await uploadOrganizationAssets({ bannerImage: file });
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                organization_settings: { ...prev.organization_settings, banner_url: res.organization_settings.banner_url }
                              }
                            : prev
                        );
                        toast.success("Banner uploaded.");
                      } catch (reason: unknown) {
                        const message = getErrorMessage(reason);
                        setError(message);
                        toast.error(message);
                      } finally {
                        setIsUploading(false);
                      }
                    })()
                  }
                />
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "organization" ? (
          <section className="surface-panel rounded-xl p-4">
            <p className="section-kicker">Organization Profile</p>
            <h3 className="headline-font mt-1.5 text-base font-bold tracking-[-0.03em] text-[var(--ink)]">Institution contact information</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InputField
                label="Name"
                value={current.organization_settings.organization_name}
                onChange={(value) =>
                  setDraft((prev) =>
                    prev ? { ...prev, organization_settings: { ...prev.organization_settings, organization_name: value } } : prev
                  )
                }
              />
              <InputField
                label="Email"
                value={current.organization_settings.organization_email}
                onChange={(value) =>
                  setDraft((prev) =>
                    prev ? { ...prev, organization_settings: { ...prev.organization_settings, organization_email: value } } : prev
                  )
                }
                type="email"
              />
              <InputField
                label="Phone"
                value={current.organization_settings.organization_phone}
                onChange={(value) =>
                  setDraft((prev) =>
                    prev ? { ...prev, organization_settings: { ...prev.organization_settings, organization_phone: value } } : prev
                  )
                }
              />
              <InputField
                label="Website"
                value={current.organization_settings.website_url}
                onChange={(value) =>
                  setDraft((prev) =>
                    prev ? { ...prev, organization_settings: { ...prev.organization_settings, website_url: value } } : prev
                  )
                }
              />
              <div className="md:col-span-2">
                <InputField
                  label="Address"
                  value={current.organization_settings.organization_address}
                  onChange={(value) =>
                    setDraft((prev) =>
                      prev ? { ...prev, organization_settings: { ...prev.organization_settings, organization_address: value } } : prev
                    )
                  }
                />
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "notifications" ? (
          <section className="surface-panel rounded-xl p-4">
            <p className="section-kicker">Notifications</p>
            <h3 className="headline-font mt-1.5 text-base font-bold tracking-[-0.03em] text-[var(--ink)]">Delivery preferences and reminder policies</h3>
            <div className="mt-6 grid gap-3">
              <ToggleField
                label="Email notifications"
                checked={current.system_settings.email_notifications_enabled}
                onChange={(checked) =>
                  setDraft((prev) =>
                    prev ? { ...prev, system_settings: { ...prev.system_settings, email_notifications_enabled: checked } } : prev
                  )
                }
              />
              <ToggleField
                label="SMS notifications"
                checked={current.system_settings.sms_notifications_enabled}
                onChange={(checked) =>
                  setDraft((prev) =>
                    prev ? { ...prev, system_settings: { ...prev.system_settings, sms_notifications_enabled: checked } } : prev
                  )
                }
              />
              <ToggleField
                label="3-day event reminders"
                checked={current.system_settings.event_reminder_3_days_enabled}
                onChange={(checked) =>
                  setDraft((prev) =>
                    prev ? { ...prev, system_settings: { ...prev.system_settings, event_reminder_3_days_enabled: checked } } : prev
                  )
                }
              />
              <ToggleField
                label="1-day event reminders"
                checked={current.system_settings.event_reminder_1_day_enabled}
                onChange={(checked) =>
                  setDraft((prev) =>
                    prev ? { ...prev, system_settings: { ...prev.system_settings, event_reminder_1_day_enabled: checked } } : prev
                  )
                }
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  void sendInvitationReminders("both")
                    .then((result: ReminderResponse) =>
                      toast.info(
                        `Reminders queued: ${result["3_day_reminders"]} for 3-day and ${result["1_day_reminders"]} for 1-day.`,
                        "Reminders queued"
                      )
                    )
                    .catch((reason: unknown) => {
                      const message = getErrorMessage(reason);
                      setError(message);
                      toast.error(message);
                    })
                }
                className="secondary-button rounded-md px-4 py-2.5 text-sm font-semibold"
              >
                Send Due Reminders Now
              </button>
            </div>
          </section>
        ) : null}

        {activeTab === "smtp" ? (
          <section className="surface-panel rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="section-kicker">SMTP Configuration</p>
                <h3 className="headline-font mt-1.5 text-base font-bold tracking-[-0.03em] text-[var(--ink)]">Email delivery settings</h3>
              </div>
              <button
                type="button"
                disabled={isSendingTestEmail}
                onClick={() => {
                  setIsSendingTestEmail(true);
                  setError(null);
                  sendTestEmail(testEmailRecipient)
                    .then((result: TestEmailResponse) => toast.success(result.message, "Test email sent"))
                    .catch((reason: unknown) => {
                      const message = getErrorMessage(reason);
                      setError(message);
                      toast.error(message);
                    })
                    .finally(() => setIsSendingTestEmail(false));
                }}
                className="primary-button rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {isSendingTestEmail ? "Sending..." : "Test Email Connection"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <InputField
                  label="SMTP host"
                  value={current.system_settings.smtp_host}
                  onChange={(value) =>
                    setDraft((prev) => (prev ? { ...prev, system_settings: { ...prev.system_settings, smtp_host: value } } : prev))
                  }
                />
              </div>
              <InputField
                label="SMTP port"
                value={String(current.system_settings.smtp_port ?? 587)}
                onChange={(value) =>
                  setDraft((prev) =>
                    prev ? { ...prev, system_settings: { ...prev.system_settings, smtp_port: Number(value || 0) } } : prev
                  )
                }
                type="number"
              />
              <InputField
                label="SMTP username"
                value={current.system_settings.smtp_username}
                onChange={(value) =>
                  setDraft((prev) =>
                    prev ? { ...prev, system_settings: { ...prev.system_settings, smtp_username: value } } : prev
                  )
                }
              />
              <div className="md:col-span-2">
                <InputField
                  label={`SMTP password ${current.system_settings.smtp_password_configured ? "(configured)" : "(not set)"}`}
                  value={current.system_settings.smtp_password}
                  onChange={(value) =>
                    setDraft((prev) =>
                      prev ? { ...prev, system_settings: { ...prev.system_settings, smtp_password: value } } : prev
                    )
                  }
                  type="password"
                />
              </div>
              <InputField
                label="Sender name"
                value={current.system_settings.sender_name}
                onChange={(value) =>
                  setDraft((prev) =>
                    prev ? { ...prev, system_settings: { ...prev.system_settings, sender_name: value } } : prev
                  )
                }
              />
              <InputField
                label="Sender email"
                value={current.system_settings.sender_email}
                onChange={(value) =>
                  setDraft((prev) =>
                    prev ? { ...prev, system_settings: { ...prev.system_settings, sender_email: value } } : prev
                  )
                }
                type="email"
              />
              <ToggleField
                label="Use TLS"
                checked={current.system_settings.smtp_use_tls}
                onChange={(checked) =>
                  setDraft((prev) =>
                    prev ? { ...prev, system_settings: { ...prev.system_settings, smtp_use_tls: checked } } : prev
                  )
                }
              />
              <ToggleField
                label="Use SSL"
                checked={current.system_settings.smtp_use_ssl}
                onChange={(checked) =>
                  setDraft((prev) =>
                    prev ? { ...prev, system_settings: { ...prev.system_settings, smtp_use_ssl: checked } } : prev
                  )
                }
              />
              <div className="md:col-span-2">
                <InputField
                  label="Test email recipient"
                  value={testEmailRecipient}
                  onChange={setTestEmailRecipient}
                  type="email"
                />
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "access" ? (
          <section className="surface-panel rounded-xl p-4">
            <p className="section-kicker">Access Control</p>
            <h3 className="headline-font mt-1.5 text-base font-bold tracking-[-0.03em] text-[var(--ink)]">Password and recovery controls</h3>
            {forcePasswordChange ? (
              <p className="mt-4 rounded-md bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[var(--status-warning-text)]">
                Password change is required before continuing.
              </p>
            ) : null}
            <div className="mt-6">
              <PasswordPanel
                currentPassword={currentPassword}
                newPassword={newPassword}
                confirmPassword={confirmPassword}
                isChangingPassword={isChangingPassword}
                onCurrentPasswordChange={setCurrentPassword}
                onNewPasswordChange={setNewPassword}
                onConfirmPasswordChange={setConfirmPassword}
                onSubmit={() => void handlePasswordChange()}
              />
            </div>
          </section>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--line)] pt-4">
          <button type="button" onClick={discardChanges} className="secondary-button rounded-md px-4 py-2.5 text-sm font-semibold">
            Discard Changes
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void saveSettings()}
            className="primary-button rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Apply System Updates"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="section-kicker">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        className="institutional-input rounded-md px-4 py-3 outline-none"
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg bg-[var(--surface-low)] px-4 py-3">
      <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function AssetTile({ label, url }: { label: string; url?: string }) {
  const resolvedUrl = resolveAssetUrl(url);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [resolvedUrl]);

  return (
    <div className="rounded-xl bg-[var(--surface-low)] p-4">
      <p className="section-kicker">{label}</p>
      <div className="mt-4 grid min-h-[10rem] place-items-center rounded-lg bg-[var(--surface-card)] p-4">
        {resolvedUrl && !loadFailed ? (
          <img
            src={resolvedUrl}
            alt={label}
            onError={() => setLoadFailed(true)}
            className="max-h-28 w-auto object-contain"
          />
        ) : (
          <span className="text-sm text-[var(--muted)]">{resolvedUrl ? "Preview unavailable" : "Not set"}</span>
        )}
      </div>
    </div>
  );
}

function UploadField({
  label,
  disabled,
  onFileSelect
}: {
  label: string;
  disabled: boolean;
  onFileSelect: (file: File) => Promise<void>;
}) {
  return (
    <label className="grid gap-2">
      <span className="section-kicker">{label}</span>
      <input
        disabled={disabled}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }
          void onFileSelect(file).catch(() => undefined);
        }}
        className="institutional-input rounded-md border-dashed px-4 py-3 text-sm outline-none disabled:opacity-60"
      />
    </label>
  );
}

function PasswordPanel({
  currentPassword,
  newPassword,
  confirmPassword,
  isChangingPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit
}: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  isChangingPassword: boolean;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InputField label="Current password" value={currentPassword} onChange={onCurrentPasswordChange} type="password" />
      <div className="hidden md:block" />
      <InputField label="New password" value={newPassword} onChange={onNewPasswordChange} type="password" />
      <InputField label="Confirm new password" value={confirmPassword} onChange={onConfirmPasswordChange} type="password" />
      <div className="md:col-span-2">
        <button
          type="button"
          disabled={isChangingPassword}
          onClick={onSubmit}
          className="primary-button rounded-md px-4 py-3 text-sm font-semibold disabled:opacity-60"
        >
          {isChangingPassword ? "Updating..." : "Change Password"}
        </button>
      </div>
    </div>
  );
}
