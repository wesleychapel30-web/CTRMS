import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../components/DataTable";
import { SectionCard } from "../components/SectionCard";
import { UserActionMenu } from "../components/UserActionMenu";
import {
  createUser,
  deactivateUser,
  fetchActivityLogs,
  fetchRbacOverview,
  fetchUserManagement,
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
  const { hasPermission } = useSession();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [activity, setActivity] = useState<ActivityLogRecord[]>([]);
  const [rbac, setRbac] = useState<Awaited<ReturnType<typeof fetchRbacOverview>> | null>(null);
  const [selectedRoleKey, setSelectedRoleKey] = useState("");
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>([]);
  const [isSavingRbac, setIsSavingRbac] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetForcePasswordChange, setResetForcePasswordChange] = useState(true);

  const isAdmin = hasPermission("user:manage");
  const canManageRbac = hasPermission("rbac:manage");
  const canAssignRole = hasPermission("user:assign_role") || hasPermission("user:manage");
  const canDeactivateUsers = hasPermission("user:deactivate") || hasPermission("user:manage");
  const canResetPassword = hasPermission("user:reset_password") || hasPermission("user:manage");
  const canViewActivity = hasPermission("audit:view");

  const users = overview?.users ?? [];
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  const toMessage = (reason: unknown) => (reason instanceof Error ? reason.message : "Request failed");
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
    const adminData = await fetchUserManagement();
    setOverview(adminData);

    if (canViewActivity) {
      const activityData = await fetchActivityLogs();
      setActivity(activityData.logs.slice(0, 8));
    } else {
      setActivity([]);
    }

    if (canManageRbac) {
      const rbacOverview = await fetchRbacOverview();
      setRbac(rbacOverview);
      if (!selectedRoleKey && rbacOverview.roles.length) {
        const firstRoleKey = rbacOverview.roles[0].key;
        setSelectedRoleKey(firstRoleKey);
        setSelectedPermissionKeys(rbacOverview.mapping[firstRoleKey] ?? []);
      }
    }
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
    if (!isAdmin) {
      return;
    }
    void loadAdmin().catch((reason) => setError(toMessage(reason)));
  }, [isAdmin, canManageRbac, canViewActivity]);

  const availableCreateAdditionalRoles = useMemo(
    () => ROLE_OPTIONS.filter((option) => option.key !== createForm.role),
    [createForm.role]
  );
  const availableEditAdditionalRoles = useMemo(
    () => ROLE_OPTIONS.filter((option) => option.key !== editForm.role),
    [editForm.role]
  );

  if (!isAdmin) {
    return <SectionCard title="User Management">You do not have permission to manage users.</SectionCard>;
  }

  const updateUserStatus = async (target: UserRow, payload: Parameters<typeof updateUser>[1], message: string) => {
    setError(null);
    await updateUser(target.id, payload);
    setStatusMessage(message);
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
    setStatusMessage(message);
    await loadAdmin();
  };

  const buildUserActions = (user: UserRow): UserAction[] => {
    const lifecycle = resolveUserLifecycleState(user);
    const actions: UserAction[] = [
      { key: "edit", label: "Edit User", onClick: () => setSelectedUserId(user.id) },
      { key: "assign-role", label: "Assign Role", onClick: () => setSelectedUserId(user.id) }
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
            void toggleUserActivation(user).catch((reason) => setError(toMessage(reason)));
          },
          destructive: true
        });
        actions.push({
          key: "lock-user",
          label: "Lock User",
          onClick: () => {
            if (!window.confirm("Lock this user account?")) return;
            void updateUserStatus(user, { is_active_staff: false }, "User locked.").catch((reason) => setError(toMessage(reason)));
          }
        });
        actions.push({
          key: "archive-user",
          label: "Archive User",
          onClick: () => {
            if (!window.confirm("Archive this user account?")) return;
            void updateUserStatus(user, { is_archived: true, is_active: false }, "User archived.").catch((reason) => setError(toMessage(reason)));
          },
          destructive: true
        });
      } else if (lifecycle === "inactive") {
        actions.push({
          key: "activate",
          label: "Activate User",
          onClick: () => {
            if (!window.confirm("Activate this user account?")) return;
            void toggleUserActivation(user).catch((reason) => setError(toMessage(reason)));
          }
        });
        actions.push({
          key: "archive-user",
          label: "Archive User",
          onClick: () => {
            if (!window.confirm("Archive this user account?")) return;
            void updateUserStatus(user, { is_archived: true, is_active: false }, "User archived.").catch((reason) => setError(toMessage(reason)));
          },
          destructive: true
        });
      } else if (lifecycle === "archived") {
        actions.push({
          key: "restore-user",
          label: "Restore User",
          onClick: () => {
            if (!window.confirm("Restore this archived user?")) return;
            void updateUserStatus(user, { is_archived: false }, "User restored from archive.").catch((reason) => setError(toMessage(reason)));
          }
        });
      } else if (lifecycle === "locked") {
        actions.push({
          key: "unlock-user",
          label: "Unlock User",
          onClick: () => {
            if (!window.confirm("Unlock this user account?")) return;
            void updateUserStatus(user, { is_active_staff: true }, "User unlocked.").catch((reason) => setError(toMessage(reason)));
          }
        });
      }
    }

    return actions;
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <SectionCard title="User Management" subtitle="Manage users, roles, and permissions.">
          {statusMessage ? <p className="mb-3 text-sm text-emerald-700 dark:text-emerald-300">{statusMessage}</p> : null}
          {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Active Users" value={String(overview?.summary.active_users ?? 0)} />
            <StatTile label="Directors" value={String(overview?.summary.directors ?? 0)} />
            <StatTile label="Administrators" value={String(overview?.summary.admins ?? 0)} />
            <StatTile label="Departments" value={String(overview?.summary.departments ?? 0)} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Create User</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={createForm.full_name} onChange={(event) => setCreateForm((prev) => ({ ...prev, full_name: event.target.value }))} placeholder="Full name" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-950" />
              <input value={createForm.username} onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))} placeholder="Username" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-950" />
              <input value={createForm.email} onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" type="email" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-950" />
              <input value={createForm.department} onChange={(event) => setCreateForm((prev) => ({ ...prev, department: event.target.value }))} placeholder="Department" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-950" />
              <select
                value={createForm.role}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    role: event.target.value,
                    additional_roles: prev.additional_roles.filter((roleKey) => roleKey !== event.target.value)
                  }))
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input value={createForm.password} onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))} placeholder="Temporary password" type="password" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-950" />
              <label className="md:col-span-2 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950">
                <span>Force password change on first login</span>
                <input type="checkbox" checked={createForm.force_password_change} onChange={(event) => setCreateForm((prev) => ({ ...prev, force_password_change: event.target.checked }))} />
              </label>
              <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Additional Roles</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableCreateAdditionalRoles.map((option) => (
                    <label key={option.key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
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
            <button
              type="button"
              onClick={() =>
                void createUser(createForm)
                  .then(() => {
                    setCreateForm(emptyCreateForm);
                    setStatusMessage("User created.");
                    return loadAdmin();
                  })
                  .catch((reason) => setError(toMessage(reason)))
              }
              className="mt-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-cyan-500 dark:text-slate-900"
            >
              Add User
            </button>
          </div>

          <DataTable
            columns={[
              {
                key: "name",
                label: "User",
                render: (user) => (
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{user.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                  </div>
                )
              },
              {
                key: "role_label",
                label: "Role",
                render: (user) => (
                  <div>
                    <p className="text-sm">{user.role_label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
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
            emptyMessage="No users found."
          />
        </SectionCard>

        {selectedUser ? (
          <SectionCard title="Edit User" subtitle="Update profile and account state.">
            <div className="grid gap-3 md:grid-cols-2">
              <input value={editForm.full_name} onChange={(event) => setEditForm((prev) => ({ ...prev, full_name: event.target.value }))} placeholder="Full name" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-900" />
              <input value={editForm.email} onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" type="email" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-900" />
              <input value={editForm.department} onChange={(event) => setEditForm((prev) => ({ ...prev, department: event.target.value }))} placeholder="Department" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-900" />
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
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                <span>Active</span>
                <input type="checkbox" disabled={!canDeactivateUsers} checked={editForm.is_active} onChange={(event) => setEditForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                <span>Archived</span>
                <input type="checkbox" disabled={!canDeactivateUsers} checked={editForm.is_archived} onChange={(event) => setEditForm((prev) => ({ ...prev, is_archived: event.target.checked }))} />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                <span>Locked</span>
                <input
                  type="checkbox"
                  disabled={!canDeactivateUsers}
                  checked={!editForm.is_active_staff}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, is_active_staff: !event.target.checked }))}
                />
              </label>
              <label className="md:col-span-2 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                <span>Force password change on next login</span>
                <input type="checkbox" disabled={!canResetPassword} checked={editForm.force_password_change} onChange={(event) => setEditForm((prev) => ({ ...prev, force_password_change: event.target.checked }))} />
              </label>
              <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Additional Roles</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableEditAdditionalRoles.map((option) => (
                    <label key={option.key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
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
                      setStatusMessage("User updated.");
                      return loadAdmin();
                    })
                    .catch((reason) => setError(toMessage(reason)))
                }
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-cyan-500 dark:text-slate-900"
              >
                Save Changes
              </button>
              <button type="button" onClick={() => setSelectedUserId(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-700">
                Clear Selection
              </button>
            </div>
          </SectionCard>
        ) : null}

        {resetTarget ? (
          <SectionCard title="Reset Password" subtitle={`Reset password for ${resetTarget.name}.`}>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={resetPasswordValue} onChange={(event) => setResetPasswordValue(event.target.value)} placeholder="New temporary password" type="password" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-900" />
              <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                <span>Force password change on next login</span>
                <input type="checkbox" checked={resetForcePasswordChange} onChange={(event) => setResetForcePasswordChange(event.target.checked)} />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void resetUserPassword(resetTarget.id, {
                    new_password: resetPasswordValue,
                    force_password_change: resetForcePasswordChange
                  })
                    .then(() => {
                      setStatusMessage("Password reset completed.");
                      setResetTarget(null);
                      setResetPasswordValue("");
                      setResetForcePasswordChange(true);
                      return loadAdmin();
                    })
                    .catch((reason) => setError(toMessage(reason)))
                }
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-cyan-500 dark:text-slate-900"
              >
                Reset Password
              </button>
              <button type="button" onClick={() => setResetTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-700">
                Cancel
              </button>
            </div>
          </SectionCard>
        ) : null}
      </div>

      <div className="space-y-6">
        {canManageRbac ? (
          <SectionCard title="Roles & Permissions" subtitle="Permission mapping by role.">
            {rbac ? (
              <div className="space-y-4">
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
                    {rbac.permissions.map((perm) => (
                      <label key={perm.key} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                        <input
                          type="checkbox"
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
                        </span>
                      </label>
                    ))}
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
                          setStatusMessage("Role permissions updated.");
                          return fetchRbacOverview();
                        })
                        .then((fresh) => {
                          setRbac(fresh);
                          setSelectedPermissionKeys(fresh.mapping[selectedRoleKey] ?? []);
                        })
                        .catch((reason) => setError(toMessage(reason)))
                        .finally(() => setIsSavingRbac(false));
                    }}
                    className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-900"
                  >
                    Save Role Permissions
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading role permissions...</p>
            )}
          </SectionCard>
        ) : null}

        <SectionCard title="Activity Logs" subtitle="Recent administration actions.">
          {canViewActivity ? (
            activity.length ? (
              <div className="space-y-2">
                {activity.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{entry.user}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{entry.message ?? `${sentenceCase(entry.action_label)} · ${entry.content_type}`}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(entry.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No recent activity logs available.</p>
            )
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Activity logs are restricted to authorized roles.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1.5 text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
