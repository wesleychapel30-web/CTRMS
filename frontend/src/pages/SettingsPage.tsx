import { useEffect, useState } from "react";
import { SectionCard } from "../components/SectionCard";
import { changeOwnPassword, fetchSystemSettings, sendInvitationReminders, sendTestEmail, updateSystemSettings, uploadOrganizationAssets } from "../lib/api";
import { useSession } from "../context/SessionContext";
import { useToast } from "../context/ToastContext";
import type { SettingsOverview } from "../types";

type AssetUploadResponse = Awaited<ReturnType<typeof uploadOrganizationAssets>>;
type SettingsResponse = Awaited<ReturnType<typeof fetchSystemSettings>>;
type TestEmailResponse = Awaited<ReturnType<typeof sendTestEmail>>;
type ReminderResponse = Awaited<ReturnType<typeof sendInvitationReminders>>;

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Request failed";
}

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
    return <SectionCard title="Settings">You do not have permission to access this page.</SectionCard>;
  }

  if (isAdmin && !settings) {
    return <SectionCard title="System Settings">{error ?? "Loading settings..."}</SectionCard>;
  }

  const current = (draft ?? settings) as SettingsOverview;
  const forcePasswordChange = Boolean(user?.force_password_change);

  if (!isAdmin) {
    return (
      <SectionCard title="Settings" subtitle="Update your account password.">
        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
        {forcePasswordChange ? (
          <p className="mb-3 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
            Password change is required before continuing.
          </p>
        ) : null}
        <div className="grid gap-3 text-sm md:max-w-xl">
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Current password</span>
            <input
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">New password</span>
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Confirm new password</span>
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <button
            disabled={isChangingPassword}
            onClick={() => {
              if (newPassword !== confirmPassword) {
                setError("New password and confirmation do not match.");
                toast.error("New password and confirmation do not match.");
                return;
              }
              setIsChangingPassword(true);
              setError(null);
              changeOwnPassword({ current_password: currentPassword, new_password: newPassword })
                .then(() => refresh())
                .then(() => {
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  toast.success("Password changed successfully.");
                })
                .catch((reason: unknown) => {
                  const message = getErrorMessage(reason);
                  setError(message);
                  toast.error(message);
                })
                .finally(() => setIsChangingPassword(false));
            }}
            className="mt-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-blue-500"
          >
            {isChangingPassword ? "Updating..." : "Change Password"}
          </button>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SectionCard title="Organization Settings" subtitle="Branding and contact information.">
        <div className="grid gap-3 text-sm">
          <div className="rounded-[28px] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Brand assets</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <AssetPreview label="Logo" url={current.organization_settings.logo_url} />
              <AssetPreview label="Favicon" url={current.organization_settings.favicon_url} />
              <AssetPreview label="Banner" url={current.organization_settings.banner_url} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Upload logo</span>
                <input
                  disabled={!isAdmin || isUploading}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setIsUploading(true);
                    uploadOrganizationAssets({ logo: file })
                      .then((res: AssetUploadResponse) => {
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                organization_settings: {
                                  ...prev.organization_settings,
                                  logo_url: res.organization_settings.logo_url
                                }
                              }
                            : prev
                        );
                        toast.success("Logo uploaded.");
                      })
                      .catch((reason: unknown) => {
                        const message = getErrorMessage(reason);
                        setError(message);
                        toast.error(message);
                      })
                      .finally(() => setIsUploading(false));
                  }}
                  className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Upload favicon</span>
                <input
                  disabled={!isAdmin || isUploading}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setIsUploading(true);
                    uploadOrganizationAssets({ favicon: file })
                      .then((res: AssetUploadResponse) => {
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                organization_settings: {
                                  ...prev.organization_settings,
                                  favicon_url: res.organization_settings.favicon_url
                                }
                              }
                            : prev
                        );
                        toast.success("Favicon uploaded.");
                      })
                      .catch((reason: unknown) => {
                        const message = getErrorMessage(reason);
                        setError(message);
                        toast.error(message);
                      })
                      .finally(() => setIsUploading(false));
                  }}
                  className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Upload banner</span>
                <input
                  disabled={!isAdmin || isUploading}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setIsUploading(true);
                    uploadOrganizationAssets({ bannerImage: file })
                      .then((res: AssetUploadResponse) => {
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                organization_settings: {
                                  ...prev.organization_settings,
                                  banner_url: res.organization_settings.banner_url
                                }
                              }
                            : prev
                        );
                        toast.success("Banner uploaded.");
                      })
                      .catch((reason: unknown) => {
                        const message = getErrorMessage(reason);
                        setError(message);
                        toast.error(message);
                      })
                      .finally(() => setIsUploading(false));
                  }}
                  className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                />
              </label>
            </div>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Name</span>
            <input
              value={current.organization_settings.organization_name}
              disabled={!isAdmin}
              onChange={(event) =>
                setDraft((prev) =>
                  prev
                    ? { ...prev, organization_settings: { ...prev.organization_settings, organization_name: event.target.value } }
                    : prev
                )
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Email</span>
            <input
              value={current.organization_settings.organization_email}
              disabled={!isAdmin}
              onChange={(event) =>
                setDraft((prev) =>
                  prev
                    ? { ...prev, organization_settings: { ...prev.organization_settings, organization_email: event.target.value } }
                    : prev
                )
              }
              type="email"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Phone</span>
            <input
              value={current.organization_settings.organization_phone}
              disabled={!isAdmin}
              onChange={(event) =>
                setDraft((prev) =>
                  prev
                    ? { ...prev, organization_settings: { ...prev.organization_settings, organization_phone: event.target.value } }
                    : prev
                )
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Address</span>
            <input
              value={current.organization_settings.organization_address}
              disabled={!isAdmin}
              onChange={(event) =>
                setDraft((prev) =>
                  prev
                    ? { ...prev, organization_settings: { ...prev.organization_settings, organization_address: event.target.value } }
                    : prev
                )
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Website</span>
            <input
              value={current.organization_settings.website_url}
              disabled={!isAdmin}
              onChange={(event) =>
                setDraft((prev) =>
                  prev ? { ...prev, organization_settings: { ...prev.organization_settings, website_url: event.target.value } } : prev
                )
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
        </div>
      </SectionCard>
      <SectionCard title="System Controls" subtitle="Notifications, email, and backups.">
        <div className="grid gap-3 text-sm">
          {!isAdmin ? (
            <p className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Only administrators can change system settings.
            </p>
          ) : null}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Site name</span>
            <input
              value={current.system_settings.site_name}
              disabled={!isAdmin}
              onChange={(event) =>
                setDraft((prev) =>
                  prev ? { ...prev, system_settings: { ...prev.system_settings, site_name: event.target.value } } : prev
                )
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Support email</span>
            <input
              value={current.system_settings.support_email}
              disabled={!isAdmin}
              onChange={(event) =>
                setDraft((prev) =>
                  prev ? { ...prev, system_settings: { ...prev.system_settings, support_email: event.target.value } } : prev
                )
              }
              type="email"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <div className="grid gap-2 rounded-3xl border border-slate-200 bg-white/70 px-4 py-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">SMTP / Email Sender</p>
            <label className="grid gap-1.5">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-400">SMTP host</span>
              <input
                value={current.system_settings.smtp_host}
                disabled={!isAdmin}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev ? { ...prev, system_settings: { ...prev.system_settings, smtp_host: event.target.value } } : prev
                  )
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              />
            </label>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">SMTP port</span>
                <input
                  value={String(current.system_settings.smtp_port ?? 587)}
                  disabled={!isAdmin}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev
                        ? { ...prev, system_settings: { ...prev.system_settings, smtp_port: Number(event.target.value || 0) } }
                        : prev
                    )
                  }
                  type="number"
                  min="1"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">SMTP username</span>
                <input
                  value={current.system_settings.smtp_username}
                  disabled={!isAdmin}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, system_settings: { ...prev.system_settings, smtp_username: event.target.value } } : prev
                    )
                  }
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                />
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                SMTP password {current.system_settings.smtp_password_configured ? "(configured)" : "(not set)"}
              </span>
              <input
                value={current.system_settings.smtp_password}
                disabled={!isAdmin}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev ? { ...prev, system_settings: { ...prev.system_settings, smtp_password: event.target.value } } : prev
                  )
                }
                type="password"
                placeholder="Enter new password to update"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              />
            </label>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Sender name</span>
                <input
                  value={current.system_settings.sender_name}
                  disabled={!isAdmin}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, system_settings: { ...prev.system_settings, sender_name: event.target.value } } : prev
                    )
                  }
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Sender email</span>
                <input
                  value={current.system_settings.sender_email}
                  disabled={!isAdmin}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, system_settings: { ...prev.system_settings, sender_email: event.target.value } } : prev
                    )
                  }
                  type="email"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                />
              </label>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <span className="text-slate-700 dark:text-slate-200">Use TLS</span>
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={current.system_settings.smtp_use_tls}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, system_settings: { ...prev.system_settings, smtp_use_tls: event.target.checked } } : prev
                    )
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <span className="text-slate-700 dark:text-slate-200">Use SSL</span>
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={current.system_settings.smtp_use_ssl}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, system_settings: { ...prev.system_settings, smtp_use_ssl: event.target.checked } } : prev
                    )
                  }
                />
              </label>
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                value={testEmailRecipient}
                disabled={!isAdmin || isSendingTestEmail}
                onChange={(event) => setTestEmailRecipient(event.target.value)}
                type="email"
                placeholder="Test email recipient"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              />
              <button
                disabled={!isAdmin || isSendingTestEmail}
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
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold disabled:opacity-60 dark:border-white/10"
              >
                {isSendingTestEmail ? "Sending..." : "Send Test Email"}
              </button>
            </div>
          </div>

          <div className="grid gap-2 rounded-3xl border border-slate-200 bg-white/70 px-4 py-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Notifications</p>
            <label className="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-200">
              <span>Email notifications</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={current.system_settings.email_notifications_enabled}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          system_settings: { ...prev.system_settings, email_notifications_enabled: event.target.checked }
                        }
                      : prev
                  )
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-200">
              <span>SMS notifications</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={current.system_settings.sms_notifications_enabled}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          system_settings: { ...prev.system_settings, sms_notifications_enabled: event.target.checked }
                        }
                      : prev
                  )
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-200">
              <span>3-day event reminders</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={current.system_settings.event_reminder_3_days_enabled}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          system_settings: { ...prev.system_settings, event_reminder_3_days_enabled: event.target.checked }
                        }
                      : prev
                  )
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-200">
              <span>1-day event reminders</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={current.system_settings.event_reminder_1_day_enabled}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          system_settings: { ...prev.system_settings, event_reminder_1_day_enabled: event.target.checked }
                        }
                      : prev
                  )
                }
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Backup frequency</span>
            <select
              value={current.system_settings.backup_frequency}
              disabled={!isAdmin}
              onChange={(event) =>
                setDraft((prev) =>
                  prev ? { ...prev, system_settings: { ...prev.system_settings, backup_frequency: event.target.value } } : prev
                )
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Retention days</span>
            <input
              value={String(current.system_settings.backup_retention_days ?? 0)}
              disabled={!isAdmin}
              onChange={(event) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        system_settings: { ...prev.system_settings, backup_retention_days: Number(event.target.value) }
                      }
                    : prev
                )
              }
              type="number"
              min="0"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              disabled={!isAdmin || isSaving}
              onClick={() => {
                if (!draft) {
                  return;
                }
                setIsSaving(true);
                updateSystemSettings(draft)
                  .then((data: SettingsResponse) => {
                    setSettings(data);
                    setDraft(data);
                    toast.success("Settings saved.");
                  })
                  .catch((reason: unknown) => {
                    const message = getErrorMessage(reason);
                    setError(message);
                    toast.error(message);
                  })
                  .finally(() => setIsSaving(false));
              }}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-blue-500"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
            <button
              disabled={!isAdmin}
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
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold disabled:opacity-60 dark:border-white/10"
            >
              Send Due Reminders Now
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Password" subtitle="Update your account password.">
        {forcePasswordChange ? (
          <p className="mb-3 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
            Password change is required before continuing.
          </p>
        ) : null}
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Current password</span>
            <input
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">New password</span>
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Confirm new password</span>
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
          <button
            disabled={isChangingPassword}
            onClick={() => {
              if (newPassword !== confirmPassword) {
                setError("New password and confirmation do not match.");
                toast.error("New password and confirmation do not match.");
                return;
              }
              setIsChangingPassword(true);
              setError(null);
              changeOwnPassword({ current_password: currentPassword, new_password: newPassword })
                .then(() => refresh())
                .then(() => {
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  toast.success("Password changed successfully.");
                })
                .catch((reason: unknown) => {
                  const message = getErrorMessage(reason);
                  setError(message);
                  toast.error(message);
                })
                .finally(() => setIsChangingPassword(false));
            }}
            className="mt-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-blue-500"
          >
            {isChangingPassword ? "Updating..." : "Change Password"}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

function AssetPreview({ label, url }: { label: string; url?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <div className="mt-3 grid place-items-center rounded-2xl bg-slate-100/70 p-4 dark:bg-white/5">
        {url ? <img src={url} alt={label} className="max-h-28 w-auto object-contain" /> : <span className="text-sm text-slate-500">Not set</span>}
      </div>
    </div>
  );
}
