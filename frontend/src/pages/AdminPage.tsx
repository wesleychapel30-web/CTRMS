import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../components/DataTable";
import { SectionCard } from "../components/SectionCard";
import { UserActionMenu } from "../components/UserActionMenu";
import { WorkspaceTabs } from "../components/WorkspaceTabs";
import { useToast } from "../context/ToastContext";
import {
  createUser,
  deactivateUser,
  fetchActivityLogs,
  fetchRbacOverview,
  fetchUserManagement,
  isAuthError,
  reactivateUser,
  resetUserPassword,
  updateRolePermissions,
  updateUser
} from "../lib/api";
import { useSession } from "../context/SessionContext";
import { formatDateTime, sentenceCase } from "../lib/format";
import { resolveUserLifecycleState } from "../lib/workflowMatrix";
import type { ActivityLogRecord, AdminOverview } from "../types";

const ROLE_OPTIONS = [
  { key: "staff", label: "Staff" },
  { key: "admin", label: "Administrator" },
  { key: "director", label: "Director" },
  { key: "finance_officer", label: "Finance Officer" },
  { key: "auditor", label: "Auditor" },
  { key: "it_admin", label: "IT Administrator" }
] as const;

type UserRow = AdminOverview["users"][number];

type UserAction = {
  key: string;
  label: string;
  onClick: () => void;
  destructive?: boolean;
};

type AdminWorkspaceTab = "directory" | "selected-user" | "roles" | "activity" | "security";

const emptyCreateForm = {
  username: "",
  email: "",
  full_name: "",
  role: "staff",
  additional_roles: [] as string[],
  department: "",
  password: "",
  force_password_change: true
};

const emptyEditForm = {
  email: "",
  full_name: "",
  role: "staff",
  additional_roles: [] as string[],
  department: "",
  is_active: true,
  is_active_staff: true,
  is_archived: false,
  force_password_change: false
};

export function AdminPage() {
  const { hasPermission, refresh } = useSession();
  const toast = useToast();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [activity, setActivity] = useState<ActivityLogRecord[]>([]);
  const [rbac, setRbac] = useState<Awaited<ReturnType<typeof fetchRbacOverview>> | null>(null);
  const [selectedRoleKey, setSelectedRoleKey] = useState("");
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>([]);
  const [isSavingRbac, setIsSavingRbac] = useState(false);
  const [isLoadingRbac, setIsLoadingRbac] = useState(false);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [rbacError, setRbacError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminWorkspaceTab>("directory");
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetForcePasswordChange, setResetForcePasswordChange] = useState(true);

  const canManageUsers = hasPermission("user:manage");
  const canManageRbac = hasPermission("rbac:manage");
  const canAssignRole = hasPermission("user:assign_role") || hasPermission("user:manage");
  const canDeactivateUsers = hasPermission("user:deactivate") || hasPermission("user:manage");
  const canResetPassword = hasPermission("user:reset_password") || hasPermission("user:manage");
  const canViewActivity = hasPermission("audit:view");
  const canAccessAdminPage = canManageUsers || canManageRbac;

  const users = overview?.users ?? [];
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  const toMessage = (reason: unknown) => (reason instanceof Error ? reason.message : "Request failed");
  const toAccessMessage = (reason: unknown, fallback: string) => {
    if (isAuthError(reason)) {
      return fallback;
    }
    return toMessage(reason);
  };
  const handleActionFailure = (reason: unknown) => {
    const message = toMessage(reason);
    setError(message);
    toast.error(message);
  };
  const getUserStatus = (user: UserRow) => {
    const lifecycle = resolveUserLifecycleState(user);
    if (lifecycle === "active") return "Active";
    if (lifecycle === "inactive") return "Inactive";
    if (lifecycle === "locked") return "Locked";
    return "Archived";
  };
  const toggleRole = (current: string[], roleKey: string, checked: boolean) => {
    const next = new Set(current);
    if (checked) {
      next.add(roleKey);
    } else {
      next.delete(roleKey);
    }
    return Array.from(next).sort();
  };

  const loadAdmin = async () => {
    setError(null);
    setActivityError(null);
    setRbacError(null);

    const tasks: Promise<void>[] = [];

    if (canManageUsers) {
      tasks.push(
        fetchUserManagement()
          .then((adminData) => {
            setOverview(adminData);
          })
          .catch(async (reason) => {
            setOverview(null);
            setError(toAccessMessage(reason, "User management is not available for this account."));
            if (isAuthError(reason)) {
              await refresh({ silent: true }).catch(() => undefined);
            }
          })
      );
    } else {
      setOverview(null);
    }

    if (canViewActivity) {
      setIsLoadingActivity(true);
      tasks.push(
        fetchActivityLogs()
          .then((activityData) => {
            setActivity(activityData.logs.slice(0, 8));
            setActivityError(null);
          })
          .catch(async (reason) => {
            setActivity([]);
            setActivityError(toAccessMessage(reason, "Activity logs are not available for this account."));
            if (isAuthError(reason)) {
              await refresh({ silent: true }).catch(() => undefined);
            }
          })
          .finally(() => setIsLoadingActivity(false))
      );
    } else {
      setActivity([]);
      setActivityError(null);
      setIsLoadingActivity(false);
    }

    if (canManageRbac) {
      setIsLoadingRbac(true);
      tasks.push(
        fetchRbacOverview()
          .then((rbacOverview) => {
            setRbac(rbacOverview);
            setRbacError(null);
            const nextRoleKey =
              (selectedRoleKey && rbacOverview.roles.some((role) => role.key === selectedRoleKey) && selectedRoleKey) ||
              rbacOverview.roles[0]?.key ||
              "";
            setSelectedRoleKey(nextRoleKey);
            setSelectedPermissionKeys(nextRoleKey ? (rbacOverview.mapping[nextRoleKey] ?? []) : []);
          })
          .catch(async (reason) => {
            setRbac(null);
            setSelectedRoleKey("");
            setSelectedPermissionKeys([]);
            setRbacError(toAccessMessage(reason, "Roles and permissions are not available for this account."));
            if (isAuthError(reason)) {
              await refresh({ silent: true }).catch(() => undefined);
            }
          })
          .finally(() => setIsLoadingRbac(false))
      );
    } else {
      setRbac(null);
      setSelectedRoleKey("");
      setSelectedPermissionKeys([]);
      setRbacError(null);
      setIsLoadingRbac(false);
    }

    await Promise.all(tasks);
  };

  useEffect(() => {
    if (!selectedUser) {
      setEditForm(emptyEditForm);
      return;
    }
    setEditForm({
      email: selectedUser.email,
      full_name: selectedUser.name,
      role: selectedUser.role,
      additional_roles: selectedUser.additional_roles ?? [],
      department: selectedUser.department || "",
      is_active: selectedUser.is_active,
      is_active_staff: selectedUser.is_active_staff ?? true,
      is_archived: Boolean(selectedUser.is_archived),
      force_password_change: Boolean(selectedUser.force_password_change)
    });
  }, [selectedUser]);

  useEffect(() => {
    if (!canAccessAdminPage) {
      return;
    }
    void loadAdmin().catch((reason) => setError(toMessage(reason)));
  }, [canAccessAdminPage, canManageUsers, canManageRbac, canViewActivity]);

  const availableCreateAdditionalRoles = useMemo(
    () => ROLE_OPTIONS.filter((option) => option.key !== createForm.role),
    [createForm.role]
  );
  const availableEditAdditionalRoles = useMemo(
    () => ROLE_OPTIONS.filter((option) => option.key !== editForm.role),
    [editForm.role]
  );

  if (!canAccessAdminPage) {
    return <SectionCard title="Administration Panel">You do not have permission to access administration tools.</SectionCard>;
  }

  const policyBoundPermissions = rbac?.policy_bound_permissions ?? {};

  const updateUserStatus = async (target: UserRow, payload: Parameters<typeof updateUser>[1], message: string) => {
    setError(null);
    await updateUser(target.id, payload);
    toast.success(message, "User updated");
    await loadAdmin();
  };

  const toggleUserActivation = async (user: UserRow) => {
    setError(null);
    const activating = !user.is_active;
    let message = activating ? "User activated." : "User deactivated.";
    try {
      if (activating) {
        const response = await reactivateUser(user.id);
        if (response.message) {
          message = response.message;
        }
      } else {
        const response = await deactivateUser(user.id);
        if (response.message) {
          message = response.message;
        }
      }
    } catch {
      // Backward-compatible fallback for older backend instances.
      await updateUser(user.id, activating ? { is_active: true, is_archived: false } : { is_active: false });
    }
    toast.success(message, "Account updated");
    await loadAdmin();
  };

  const buildUserActions = (user: UserRow): UserAction[] => {
    const lifecycle = resolveUserLifecycleState(user);
    const actions: UserAction[] = [
      {
        key: "edit",
        label: "Edit User",
        onClick: () => {
          setSelectedUserId(user.id);
          setActiveTab("selected-user");
        }
      },
      {
        key: "assign-role",
        label: "Assign Role",
        onClick: () => {
          setSelectedUserId(user.id);
          setActiveTab("selected-user");
        }
      }
    ];

    if (canResetPassword) {
      actions.push({
        key: "reset-password",
        label: "Reset Password",
        onClick: () => {
          setResetTarget(user);
          setResetPasswordValue("");
          setResetForcePasswordChange(true);
        }
      });
    }

    if (canDeactivateUsers) {
      if (lifecycle === "active") {
        actions.push({
          key: "deactivate",
          label: "Deactivate User",
          onClick: () => {
            if (!window.confirm("Deactivate this user account?")) return;
            void toggleUserActivation(user).catch(handleActionFailure);
          },
          destructive: true
        });
        actions.push({
          key: "lock-user",
          label: "Lock User",
          onClick: () => {
            if (!window.confirm("Lock this user account?")) return;
            void updateUserStatus(user, { is_active_staff: false }, "User locked.").catch(handleActionFailure);
          }
        });
        actions.push({
          key: "archive-user",
          label: "Archive User",
          onClick: () => {
            if (!window.confirm("Archive this user account?")) return;
            void updateUserStatus(user, { is_archived: true, is_active: false }, "User archived.").catch(handleActionFailure);
          },
          destructive: true
        });
      } else if (lifecycle === "inactive") {
        actions.push({
          key: "activate",
          label: "Activate User",
          onClick: () => {
            if (!window.confirm("Activate this user account?")) return;
            void toggleUserActivation(user).catch(handleActionFailure);
          }
        });
        actions.push({
          key: "archive-user",
          label: "Archive User",
          onClick: () => {
            if (!window.confirm("Archive this user account?")) return;
            void updateUserStatus(user, { is_archived: true, is_active: false }, "User archived.").catch(handleActionFailure);
          },
          destructive: true
        });
      } else if (lifecycle === "archived") {
        actions.push({
          key: "restore-user",
          label: "Restore User",
          onClick: () => {
            if (!window.confirm("Restore this archived user?")) return;
            void updateUserStatus(user, { is_archived: false }, "User restored from archive.").catch(handleActionFailure);
          }
        });
      } else if (lifecycle === "locked") {
        actions.push({
          key: "unlock-user",
          label: "Unlock User",
          onClick: () => {
            if (!window.confirm("Unlock this user account?")) return;
            void updateUserStatus(user, { is_active_staff: true }, "User unlocked.").catch(handleActionFailure);
          }
        });
      }
    }

    return actions;
  };

  const totalUsers = users.length;
  const securityHealth = totalUsers
    ? Math.max(
        0,
        Math.round((users.filter((user) => resolveUserLifecycleState(user) === "active").length / totalUsers) * 100)
      )
    : 100;
  const recentSecurityEvents = activity.filter((entry) =>
    /denied|blocked|reset|deactivate|archive|lock/i.test(`${entry.action_label} ${entry.description}`)
  );
  const workspaceTabs = useMemo(() => {
    const tabs: Array<{ key: AdminWorkspaceTab; label: string; badge?: string | number | null }> = [];
    if (canManageUsers) {
      tabs.push({ key: "directory", label: "User Directory", badge: users.length });
      tabs.push({ key: "selected-user", label: "Selected User", badge: selectedUser ? 1 : null });
    }
    if (canManageRbac) {
      tabs.push({ key: "roles", label: "Roles & Permissions", badge: rbac?.roles.length ?? null });
    }
    if (canViewActivity) {
      tabs.push({ key: "activity", label: "Activity Logs", badge: activity.length });
      tabs.push({ key: "security", label: "Security Events", badge: recentSecurityEvents.length });
    }
    return tabs;
  }, [activity.length, canManageRbac, canManageUsers, canViewActivity, rbac?.roles.length, recentSecurityEvents.length, selectedUser, users.length]);

  useEffect(() => {
    if (!workspaceTabs.some((tab) => tab.key === activeTab)) {
      const nextTab = workspaceTabs[0]?.key;
      if (nextTab) {
        setActiveTab(nextTab);
      }
    }
  }, [activeTab, workspaceTabs]);

  return (
    <>
    <div className="space-y-4">
      {canManageUsers ? (
        <section className="grid gap-4 xl:grid-cols-12">
          <div className="metric-strip rounded-xl px-4 py-4 xl:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="headline-font text-xl font-extrabold tracking-[-0.04em] text-[var(--ink)]">
                User Management
              </h2>
              <button
                type="button"
                onClick={() => setShowCreatePanel(true)}
                className="primary-button rounded-md px-3 py-2 text-xs font-semibold"
              >
                New User
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Total Users" value={String(totalUsers)} note="Users" />
              <StatTile label="Active Sessions" value={String(overview?.summary.active_users ?? 0)} note="Active now" />
              <StatTile label="Admin Events" value={String(overview?.summary.audit_events_today ?? 0)} note="Today" />
              <StatTile label="Departments" value={String(overview?.summary.departments ?? 0)} note="Units" />
            </div>
          </div>

          <div className="hero-card rounded-xl p-4 xl:col-span-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="headline-font text-sm font-bold tracking-[-0.03em] text-[var(--ink)]">
                Access Overview
              </h3>
              <span className="rounded-full bg-[var(--surface-low)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                {securityHealth}% secure
              </span>
            </div>
            <div className="mt-3">
              <div className="h-1.5 rounded-full bg-[var(--surface-container)]">
                <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${securityHealth}%` }} />
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">Sensitive actions remain permission-gated and recorded.</p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <OverviewTile label="Administrators" value={String(overview?.summary.admins ?? 0)} note="Assigned" />
              <OverviewTile label="Directors" value={String(overview?.summary.directors ?? 0)} note="Assigned" />
              <OverviewTile label="Flagged Events" value={String(recentSecurityEvents.length)} note="Current view" />
              <OverviewTile
                label="Selection"
                value={selectedUser ? selectedUser.name : "None"}
                note={selectedUser ? getUserStatus(selectedUser) : "Choose a user"}
              />
            </div>
          </div>
        </section>
      ) : null}

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {canManageUsers ? (
        <section className="surface-panel overflow-hidden rounded-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-low)] px-4 py-3">
            <div>
              <h3 className="headline-font text-sm font-bold tracking-[-0.02em] text-[var(--ink)]">User Directory</h3>
              {selectedUser ? (
                <p className="mt-0.5 text-xs text-[var(--muted)]">Selected: {selectedUser.name}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedUser ? (
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="secondary-button rounded-md px-4 py-2.5 text-sm font-semibold"
                >
                  Clear Selection
                </button>
              ) : null}
            </div>
          </div>
          <DataTable
            columns={[
              {
                key: "name",
                label: "User",
                render: (user) => (
                  <div className="space-y-0.5 leading-tight">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{user.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{user.email}</p>
                  </div>
                )
              },
              {
                key: "role_label",
                label: "Role",
                render: (user) => (
                  <div className="space-y-0.5 leading-tight">
                    <p className="text-sm">{user.role_label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {user.additional_roles?.length ? `+ ${user.additional_roles.join(", ")}` : "No additional role"}
                    </p>
                  </div>
                )
              },
              {
                key: "status",
                label: "Status",
                render: (user) => (
                  <div>
                    <p className="text-sm">{getUserStatus(user)}</p>
                    {user.force_password_change ? <p className="text-xs text-amber-600 dark:text-amber-300">Password change required</p> : null}
                  </div>
                )
              },
              {
                key: "last_login",
                label: "Last Login",
                render: (user) => {
                  const lastLogin = (user as UserRow & { last_login?: string | null }).last_login;
                  return <span className="text-sm text-slate-600 dark:text-slate-300">{lastLogin ? formatDateTime(lastLogin) : "N/A"}</span>;
                }
              },
              {
                key: "actions",
                label: "Actions",
                render: (user) => <UserActionMenu actions={buildUserActions(user)} />
              }
            ]}
            rows={users}
            density="compact"
            emptyMessage="No users found."
          />
        </section>
      ) : null}

      <section className="surface-panel rounded-xl p-3">
        <WorkspaceTabs tabs={workspaceTabs} activeTab={activeTab} onChange={setActiveTab} />
      </section>

      {canManageUsers && activeTab === "directory" ? (
        <section className="surface-panel overflow-hidden rounded-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--surface-low)] px-6 py-4">
            <div>
              <h3 className="headline-font text-base font-bold tracking-[-0.03em] text-[var(--ink)]">User Directory</h3>
              {selectedUser ? <p className="mt-1 text-sm text-[var(--muted)]">Selected: {selectedUser.name}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedUser ? (
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="secondary-button rounded-md px-4 py-2.5 text-sm font-semibold"
                >
                  Clear Selection
                </button>
              ) : null}
            </div>
          </div>
          <DataTable
            columns={[
              {
                key: "name",
                label: "User",
                render: (user) => (
                  <div className="space-y-0.5 leading-tight">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{user.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{user.email}</p>
                  </div>
                )
              },
              {
                key: "role_label",
                label: "Role",
                render: (user) => (
                  <div className="space-y-0.5 leading-tight">
                    <p className="text-sm">{user.role_label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {user.additional_roles?.length ? `+ ${user.additional_roles.join(", ")}` : "No additional role"}
                    </p>
                  </div>
                )
              },
              {
                key: "status",
                label: "Status",
                render: (user) => (
                  <div>
                    <p className="text-sm">{getUserStatus(user)}</p>
                    {user.force_password_change ? <p className="text-xs text-amber-600 dark:text-amber-300">Password change required</p> : null}
                  </div>
                )
              },
              {
                key: "last_login",
                label: "Last Login",
                render: (user) => {
                  const lastLogin = (user as UserRow & { last_login?: string | null }).last_login;
                  return <span className="text-sm text-slate-600 dark:text-slate-300">{lastLogin ? formatDateTime(lastLogin) : "N/A"}</span>;
                }
              },
              {
                key: "actions",
                label: "Actions",
                render: (user) => <UserActionMenu actions={buildUserActions(user)} />
              }
            ]}
            rows={users}
            density="compact"
            emptyMessage="No users found."
          />
        </section>
      ) : null}

      {canManageUsers && activeTab === "selected-user" ? (
        selectedUser ? (
          <SectionCard
            title="Selected User"
            action={
              canResetPassword ? (
                <button
                  type="button"
                  onClick={() => {
                    setResetTarget(selectedUser);
                    setResetPasswordValue("");
                    setResetForcePasswordChange(true);
                  }}
                  className="secondary-button rounded-md px-3 py-2 text-xs font-semibold"
                >
                  Reset Password
                </button>
              ) : undefined
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewTile label="Name" value={selectedUser.name} note={selectedUser.username} />
              <OverviewTile label="Status" value={getUserStatus(selectedUser)} note={selectedUser.role_label} />
              <OverviewTile label="Department" value={selectedUser.department || "Unassigned"} note="Assigned unit" />
              <OverviewTile
                label="Password"
                value={selectedUser.force_password_change ? "Change required" : "Normal"}
                note="Next sign-in"
              />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input value={editForm.full_name} onChange={(event) => setEditForm((prev) => ({ ...prev, full_name: event.target.value }))} placeholder="Full name" className="institutional-input rounded-md px-4 py-3 text-sm outline-none" />
              <input value={editForm.email} onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" type="email" className="institutional-input rounded-md px-4 py-3 text-sm outline-none" />
              <input value={editForm.department} onChange={(event) => setEditForm((prev) => ({ ...prev, department: event.target.value }))} placeholder="Department" className="institutional-input rounded-md px-4 py-3 text-sm outline-none" />
              <select
                disabled={!canAssignRole}
                value={editForm.role}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    role: event.target.value,
                    additional_roles: prev.additional_roles.filter((roleKey) => roleKey !== event.target.value)
                  }))
                }
                className="institutional-input rounded-md px-4 py-3 text-sm outline-none disabled:opacity-60"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center justify-between rounded-lg bg-[var(--surface-low)] px-4 py-3 text-sm">
                <span className="font-medium text-[var(--ink)]">Active</span>
                <input type="checkbox" disabled={!canDeactivateUsers} checked={editForm.is_active} onChange={(event) => setEditForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
              </label>
              <label className="flex items-center justify-between rounded-lg bg-[var(--surface-low)] px-4 py-3 text-sm">
                <span className="font-medium text-[var(--ink)]">Archived</span>
                <input type="checkbox" disabled={!canDeactivateUsers} checked={editForm.is_archived} onChange={(event) => setEditForm((prev) => ({ ...prev, is_archived: event.target.checked }))} />
              </label>
              <label className="flex items-center justify-between rounded-lg bg-[var(--surface-low)] px-4 py-3 text-sm">
                <span className="font-medium text-[var(--ink)]">Locked</span>
                <input
                  type="checkbox"
                  disabled={!canDeactivateUsers}
                  checked={!editForm.is_active_staff}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, is_active_staff: !event.target.checked }))}
                />
              </label>
              <label className="md:col-span-2 flex items-center justify-between rounded-lg bg-[var(--surface-low)] px-4 py-3 text-sm">
                <span className="font-medium text-[var(--ink)]">Force password change on next login</span>
                <input type="checkbox" disabled={!canResetPassword} checked={editForm.force_password_change} onChange={(event) => setEditForm((prev) => ({ ...prev, force_password_change: event.target.checked }))} />
              </label>
              <div className="md:col-span-2 rounded-lg bg-[var(--surface-low)] px-4 py-4">
                <p className="section-kicker">Additional Roles</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableEditAdditionalRoles.map((option) => (
                    <label key={option.key} className="mt-3 flex items-center gap-2 text-sm text-[var(--ink)]">
                      <input
                        type="checkbox"
                        disabled={!canAssignRole}
                        checked={editForm.additional_roles.includes(option.key)}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, additional_roles: toggleRole(prev.additional_roles, option.key, event.target.checked) }))
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void updateUser(selectedUser.id, {
                    email: editForm.email,
                    full_name: editForm.full_name,
                    department: editForm.department,
                    role: canAssignRole ? editForm.role : undefined,
                    additional_roles: canAssignRole ? editForm.additional_roles : undefined,
                    is_active: canDeactivateUsers ? editForm.is_active : undefined,
                    is_active_staff: canDeactivateUsers ? editForm.is_active_staff : undefined,
                    is_archived: canDeactivateUsers ? editForm.is_archived : undefined,
                    force_password_change: canResetPassword ? editForm.force_password_change : undefined
                  })
                    .then(() => {
                      toast.success("User record updated.", "Changes saved");
                      return loadAdmin();
                    })
                    .catch((reason) => {
                      const message = toMessage(reason);
                      setError(message);
                      toast.error(message);
                    })
                }
                className="primary-button rounded-md px-4 py-2.5 text-sm font-semibold"
              >
                Save Changes
              </button>
              <button type="button" onClick={() => setSelectedUserId(null)} className="secondary-button rounded-md px-4 py-2.5 text-sm font-semibold">
                Clear Selection
              </button>
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Selected User">
            <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-low)] px-4 py-10 text-center text-sm text-[var(--muted)]">
              Select a user from the User Directory tab to edit account details, roles, and access state.
            </div>
          </SectionCard>
        )
      ) : null}

      {canManageRbac && activeTab === "roles" ? (
        <SectionCard title="Roles & Permissions">
            {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
            {isLoadingRbac ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading role permissions...</p>
            ) : rbacError ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{rbacError}</p>
            ) : rbac ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Permissions marked as policy-managed are enforced by workflow rules and cannot be edited here.
                </p>
                <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Role</span>
                  <select
                    value={selectedRoleKey}
                    onChange={(event) => {
                      const key = event.target.value;
                      setSelectedRoleKey(key);
                      setSelectedPermissionKeys(rbac.mapping[key] ?? []);
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {rbac.roles.map((role) => (
                      <option key={role.key} value={role.key}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="max-h-[26rem] overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                  <div className="space-y-2">
                    {rbac.permissions.map((perm) => {
                      const policyRule = policyBoundPermissions[perm.key];
                      const policyRoles = policyRule?.allowed_roles ?? [];
                      const isPolicyManaged = Boolean(policyRule);
                      const policyScope = policyRoles
                        .map((roleKey) => ROLE_OPTIONS.find((option) => option.key === roleKey)?.label ?? sentenceCase(roleKey))
                        .join(", ");

                      return (
                        <label key={perm.key} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                          <input
                            type="checkbox"
                            disabled={isPolicyManaged}
                            checked={selectedPermissionKeys.includes(perm.key)}
                            onChange={(event) => {
                              const next = new Set(selectedPermissionKeys);
                              if (event.target.checked) next.add(perm.key);
                              else next.delete(perm.key);
                              setSelectedPermissionKeys(Array.from(next).sort());
                            }}
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-slate-900 dark:text-slate-100">{perm.name}</span>
                            <span className="block text-xs text-slate-600 dark:text-slate-300">{perm.key}</span>
                            {isPolicyManaged ? (
                              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                Fixed by policy{policyScope ? ` for ${policyScope}` : ""}. {policyRule.reason}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isSavingRbac || !selectedRoleKey}
                    onClick={() => {
                      setIsSavingRbac(true);
                      updateRolePermissions(selectedRoleKey, selectedPermissionKeys)
                        .then(() => {
                          toast.success("Role permissions updated.");
                          return fetchRbacOverview();
                        })
                        .then((fresh) => {
                          setRbac(fresh);
                          setSelectedPermissionKeys(fresh.mapping[selectedRoleKey] ?? []);
                        })
                        .catch((reason) => {
                          const message = toMessage(reason);
                          setError(message);
                          toast.error(message);
                        })
                        .finally(() => setIsSavingRbac(false));
                    }}
                    className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-900"
                  >
                    Save Role Permissions
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Role permissions are not available.</p>
            )}
        </SectionCard>
      ) : null}

      {canViewActivity && activeTab === "activity" ? (
        <SectionCard title="Activity Logs">
          {isLoadingActivity ? (
            <p className="text-sm text-[var(--muted)]">Loading activity logs...</p>
          ) : activityError ? (
            <p className="text-sm text-[var(--muted)]">{activityError}</p>
          ) : activity.length ? (
            <div className="space-y-3">
              {activity.map((entry) => (
                <div key={entry.id} className="rounded-lg bg-[var(--surface-low)] px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--ink)]">{entry.user}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{entry.message ?? `${sentenceCase(entry.action_label)} · ${entry.content_type}`}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{formatDateTime(entry.created_at)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">No recent activity logs available.</p>
          )}
        </SectionCard>
      ) : null}

      {canViewActivity && activeTab === "security" ? (
        <SectionCard title="Recent Security Events">
          {recentSecurityEvents.length ? (
            <div className="space-y-3">
              {recentSecurityEvents.slice(0, 6).map((entry) => (
                <div key={entry.id} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[var(--danger)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{entry.message ?? sentenceCase(entry.action_label)}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{entry.user} · {formatDateTime(entry.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">No flagged security events in the current view.</p>
          )}
        </SectionCard>
      ) : null}
      
    </div>

    {showCreatePanel ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
        onClick={() => setShowCreatePanel(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New user"
          className="surface-panel w-full max-w-4xl rounded-2xl p-5 shadow-2xl sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <h3 className="headline-font text-2xl font-bold tracking-[-0.04em] text-[var(--ink)]">New User</h3>
            <button type="button" onClick={() => setShowCreatePanel(false)} className="secondary-button rounded-md px-3 py-2 text-sm font-semibold">
              Close
            </button>
          </div>
          {error ? <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <input value={createForm.full_name} onChange={(event) => setCreateForm((prev) => ({ ...prev, full_name: event.target.value }))} placeholder="Full name" className="institutional-input rounded-md px-4 py-3 text-sm outline-none" />
            <input value={createForm.username} onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))} placeholder="Username" className="institutional-input rounded-md px-4 py-3 text-sm outline-none" />
            <input value={createForm.email} onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" type="email" className="institutional-input rounded-md px-4 py-3 text-sm outline-none" />
            <input value={createForm.department} onChange={(event) => setCreateForm((prev) => ({ ...prev, department: event.target.value }))} placeholder="Department" className="institutional-input rounded-md px-4 py-3 text-sm outline-none" />
            <select
              value={createForm.role}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  role: event.target.value,
                  additional_roles: prev.additional_roles.filter((roleKey) => roleKey !== event.target.value)
                }))
              }
              className="institutional-input rounded-md px-4 py-3 text-sm outline-none"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <input value={createForm.password} onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))} placeholder="Temporary password" type="password" className="institutional-input rounded-md px-4 py-3 text-sm outline-none" />
            <label className="md:col-span-2 flex items-center justify-between rounded-lg bg-[var(--surface-low)] px-4 py-3 text-sm">
              <span className="font-medium text-[var(--ink)]">Force password change on first login</span>
              <input type="checkbox" checked={createForm.force_password_change} onChange={(event) => setCreateForm((prev) => ({ ...prev, force_password_change: event.target.checked }))} />
            </label>
            <div className="md:col-span-2 rounded-lg bg-[var(--surface-low)] px-4 py-4">
              <p className="section-kicker">Additional Roles</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {availableCreateAdditionalRoles.map((option) => (
                  <label key={option.key} className="mt-3 flex items-center gap-2 text-sm text-[var(--ink)]">
                    <input
                      type="checkbox"
                      checked={createForm.additional_roles.includes(option.key)}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, additional_roles: toggleRole(prev.additional_roles, option.key, event.target.checked) }))
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setCreateForm(emptyCreateForm);
                setShowCreatePanel(false);
              }}
              className="secondary-button rounded-md px-4 py-2.5 text-sm font-semibold"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() =>
                void createUser(createForm)
                  .then(() => {
                    setCreateForm(emptyCreateForm);
                    setShowCreatePanel(false);
                    toast.success("User account created.", "User added");
                    return loadAdmin();
                  })
                  .catch((reason) => {
                    const message = toMessage(reason);
                    setError(message);
                    toast.error(message);
                  })
              }
              className="primary-button rounded-md px-4 py-2.5 text-sm font-semibold"
            >
              Add User
            </button>
          </div>
        </div>
      </div>
    ) : null}

    {resetTarget ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
        onClick={() => setResetTarget(null)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reset user password"
          className="surface-panel w-full max-w-2xl rounded-2xl p-5 shadow-2xl sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <h3 className="headline-font text-2xl font-bold tracking-[-0.04em] text-[var(--ink)]">Reset Password</h3>
            <button type="button" onClick={() => setResetTarget(null)} className="secondary-button rounded-md px-3 py-2 text-sm font-semibold">
              Close
            </button>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">{resetTarget.name}</p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <input value={resetPasswordValue} onChange={(event) => setResetPasswordValue(event.target.value)} placeholder="New temporary password" type="password" className="institutional-input rounded-md px-4 py-3 text-sm outline-none" />
            <label className="flex items-center justify-between rounded-lg bg-[var(--surface-low)] px-4 py-3 text-sm">
              <span className="font-medium text-[var(--ink)]">Force password change on next login</span>
              <input type="checkbox" checked={resetForcePasswordChange} onChange={(event) => setResetForcePasswordChange(event.target.checked)} />
            </label>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => setResetTarget(null)} className="secondary-button rounded-md px-4 py-2.5 text-sm font-semibold">
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                void resetUserPassword(resetTarget.id, {
                  new_password: resetPasswordValue,
                  force_password_change: resetForcePasswordChange
                })
                  .then(() => {
                    toast.success("Password reset completed.");
                    setResetTarget(null);
                    setResetPasswordValue("");
                    setResetForcePasswordChange(true);
                    return loadAdmin();
                  })
                  .catch((reason) => {
                    const message = toMessage(reason);
                    setError(message);
                    toast.error(message);
                  })
              }
              className="primary-button rounded-md px-4 py-2.5 text-sm font-semibold"
            >
              Reset Password
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

function StatTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="table-stat rounded-xl px-5 py-4">
      <p className="section-kicker">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{note}</p>
    </div>
  );
}

function OverviewTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="table-stat rounded-lg px-4 py-4">
      <p className="section-kicker">{label}</p>
      <p className="mt-2 line-clamp-2 text-lg font-semibold text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{note}</p>
    </div>
  );
}
