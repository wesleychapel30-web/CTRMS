import { Building2, GitBranch, Layers, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { DetailSectionCard } from "../components/DetailSectionCard";
import { InlineBanner, StatePanel } from "../components/FeedbackStates";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import {
  createBranch,
  createDepartment,
  deleteBranch,
  deleteDepartment,
  fetchOrganizationWorkspace,
  updateBranch,
  updateDepartment,
  updateOrganization,
} from "../lib/api";
import type { EnterpriseBranch, EnterpriseDepartment, EnterpriseOrganization, EnterpriseWorkflowTemplate, OrganizationWorkspace } from "../types";

type OrgFormState = {
  name: string;
  legal_name: string;
  timezone: string;
  currency_code: string;
};

type DeptFormState = {
  name: string;
  code: string;
  description: string;
};

type BranchFormState = {
  name: string;
  code: string;
  city: string;
  country: string;
  address: string;
};

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Operation failed";
}

export function OrganizationPage() {
  const toast = useToast();
  const [workspace, setWorkspace] = useState<OrganizationWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const [editingOrg, setEditingOrg] = useState(false);
  const [orgForm, setOrgForm] = useState<OrgFormState>({ name: "", legal_name: "", timezone: "", currency_code: "" });
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [showDeptForm, setShowDeptForm] = useState(false);
  const [editingDept, setEditingDept] = useState<EnterpriseDepartment | null>(null);
  const [deptForm, setDeptForm] = useState<DeptFormState>({ name: "", code: "", description: "" });
  const [deptSaving, setDeptSaving] = useState(false);
  const [deptError, setDeptError] = useState<string | null>(null);

  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<EnterpriseBranch | null>(null);
  const [branchForm, setBranchForm] = useState<BranchFormState>({ name: "", code: "", city: "", country: "", address: "" });
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  const [confirmDeleteDeptId, setConfirmDeleteDeptId] = useState<string | null>(null);
  const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null);
  const [confirmDeleteBranchId, setConfirmDeleteBranchId] = useState<string | null>(null);
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetchOrganizationWorkspace()
      .then((payload) => {
        setWorkspace(payload);
        setSelectedWorkflowId((current) => current ?? payload.workflows[0]?.id ?? null);
        setError(null);
      })
      .catch((reason) => setError(getErrorMessage(reason)))
      .finally(() => setIsLoading(false));
  }, []);

  function openEditOrg(org: EnterpriseOrganization) {
    setOrgForm({
      name: org.name,
      legal_name: org.legal_name,
      timezone: org.timezone || "Africa/Dar_es_Salaam",
      currency_code: org.currency_code || "TZS",
    });
    setOrgError(null);
    setEditingOrg(true);
  }

  async function saveOrg() {
    setOrgSaving(true);
    setOrgError(null);
    try {
      const result = await updateOrganization(orgForm);
      setWorkspace((current) => current ? { ...current, organization: result.organization } : current);
      setEditingOrg(false);
      toast.success("Organization settings saved.");
    } catch (reason) {
      const message = getErrorMessage(reason);
      setOrgError(message);
      toast.error(message);
    } finally {
      setOrgSaving(false);
    }
  }

  function openNewDept() {
    setDeptForm({ name: "", code: "", description: "" });
    setEditingDept(null);
    setDeptError(null);
    setShowDeptForm(true);
  }

  function openEditDept(dept: EnterpriseDepartment) {
    setDeptForm({ name: dept.name, code: dept.code, description: dept.description });
    setEditingDept(dept);
    setDeptError(null);
    setShowDeptForm(true);
  }

  async function saveDept() {
    setDeptSaving(true);
    setDeptError(null);
    try {
      if (editingDept) {
        const result = await updateDepartment(editingDept.id, deptForm);
        setWorkspace((current) =>
          current ? { ...current, departments: current.departments.map((d) => (d.id === editingDept.id ? result.department : d)) } : current
        );
        toast.success("Department updated.");
      } else {
        const result = await createDepartment(deptForm);
        setWorkspace((current) => current ? { ...current, departments: [...current.departments, result.department] } : current);
        toast.success("Department created.");
      }
      setShowDeptForm(false);
      setEditingDept(null);
    } catch (reason) {
      const message = getErrorMessage(reason);
      setDeptError(message);
      toast.error(message);
    } finally {
      setDeptSaving(false);
    }
  }

  function openNewBranch() {
    setBranchForm({ name: "", code: "", city: "", country: "", address: "" });
    setEditingBranch(null);
    setBranchError(null);
    setShowBranchForm(true);
  }

  function openEditBranch(branch: EnterpriseBranch) {
    setBranchForm({ name: branch.name, code: branch.code, city: branch.city, country: branch.country, address: branch.address });
    setEditingBranch(branch);
    setBranchError(null);
    setShowBranchForm(true);
  }

  async function saveBranch() {
    setBranchSaving(true);
    setBranchError(null);
    try {
      if (editingBranch) {
        const result = await updateBranch(editingBranch.id, branchForm);
        setWorkspace((current) =>
          current ? { ...current, branches: current.branches.map((b) => (b.id === editingBranch.id ? result.branch : b)) } : current
        );
        toast.success("Branch updated.");
      } else {
        const result = await createBranch(branchForm);
        setWorkspace((current) => current ? { ...current, branches: [...current.branches, result.branch] } : current);
        toast.success("Branch created.");
      }
      setShowBranchForm(false);
      setEditingBranch(null);
    } catch (reason) {
      const message = getErrorMessage(reason);
      setBranchError(message);
      toast.error(message);
    } finally {
      setBranchSaving(false);
    }
  }

  async function confirmDeleteDept(id: string) {
    setDeletingDeptId(id);
    try {
      await deleteDepartment(id);
      setWorkspace((current) => current ? { ...current, departments: current.departments.filter((d) => d.id !== id) } : current);
      setConfirmDeleteDeptId(null);
      toast.success("Department deleted.");
    } catch (reason) {
      toast.error(getErrorMessage(reason));
      // keep confirm open so user sees it didn't work
    } finally {
      setDeletingDeptId(null);
    }
  }

  async function confirmDeleteBranch(id: string) {
    setDeletingBranchId(id);
    try {
      await deleteBranch(id);
      setWorkspace((current) => current ? { ...current, branches: current.branches.filter((b) => b.id !== id) } : current);
      setConfirmDeleteBranchId(null);
      toast.success("Branch deleted.");
    } catch (reason) {
      toast.error(getErrorMessage(reason));
      // keep confirm open so user sees it didn't work
    } finally {
      setDeletingBranchId(null);
    }
  }

  if (isLoading || !workspace) {
    return <StatePanel variant="loading" title="Loading organization" message="Loading organizations, departments, and workflows." />;
  }

  if (error) {
    return <StatePanel variant="error" title="Organization unavailable" message={error} />;
  }

  const selectedWorkflow = workspace.workflows.find((item) => item.id === selectedWorkflowId) ?? workspace.workflows[0] ?? null;
  const org = workspace.organization;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="surface-panel rounded-xl px-6 py-5">
            <p className="section-kicker">Organizations</p>
            <p className="headline-font mt-3 text-3xl font-extrabold tracking-[-0.05em]">{workspace.organizations.length}</p>
          </div>
          <div className="surface-panel rounded-xl px-6 py-5">
            <p className="section-kicker">Departments</p>
            <p className="headline-font mt-3 text-3xl font-extrabold tracking-[-0.05em]">{workspace.departments.length}</p>
          </div>
          <div className="surface-panel rounded-xl px-6 py-5">
            <p className="section-kicker">Branches</p>
            <p className="headline-font mt-3 text-3xl font-extrabold tracking-[-0.05em]">{workspace.branches.length}</p>
          </div>
          <div className="surface-panel rounded-xl px-6 py-5">
            <p className="section-kicker">Workflows</p>
            <p className="headline-font mt-3 text-3xl font-extrabold tracking-[-0.05em]">{workspace.workflows.length}</p>
          </div>
        </div>

        <SectionCard
          title="Organization Settings"
          subtitle="Basic identity and configuration."
          action={org ? (
            <button type="button" onClick={() => openEditOrg(org)} className="secondary-button rounded-md px-4 py-2 text-sm font-semibold">
              Edit
            </button>
          ) : null}
        >
          {editingOrg ? (
            <div className="space-y-4">
              {orgError ? <InlineBanner variant="error" title="Save failed" message={orgError} /> : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Name</label>
                  <input
                    className="institutional-input mt-1.5 w-full rounded-md px-4 py-2.5 outline-none"
                    value={orgForm.name}
                    onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Legal Name</label>
                  <input
                    className="institutional-input mt-1.5 w-full rounded-md px-4 py-2.5 outline-none"
                    value={orgForm.legal_name}
                    onChange={(e) => setOrgForm((f) => ({ ...f, legal_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Currency Code</label>
                  <input
                    className="institutional-input mt-1.5 w-full rounded-md px-4 py-2.5 outline-none"
                    value={orgForm.currency_code}
                    placeholder="TZS"
                    maxLength={3}
                    onChange={(e) => setOrgForm((f) => ({ ...f, currency_code: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Timezone</label>
                  <input
                    className="institutional-input mt-1.5 w-full rounded-md px-4 py-2.5 outline-none"
                    value={orgForm.timezone}
                    placeholder="Africa/Dar_es_Salaam"
                    onChange={(e) => setOrgForm((f) => ({ ...f, timezone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={saveOrg}
                  disabled={orgSaving}
                  className="primary-button rounded-md px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {orgSaving ? "Saving…" : "Save Changes"}
                </button>
                <button type="button" onClick={() => setEditingOrg(false)} className="secondary-button rounded-md px-5 py-2.5 text-sm font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          ) : org ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Name", value: org.name },
                { label: "Legal Name", value: org.legal_name || "—" },
                { label: "Currency", value: org.currency_code },
                { label: "Timezone", value: org.timezone },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="section-kicker">{label}</p>
                  <p className="mt-1.5 text-sm font-semibold text-[var(--ink)]">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">No active organization is configured.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Departments"
          subtitle="Organizational units."
          action={
            <button type="button" onClick={openNewDept} className="primary-button inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold">
              <Plus className="h-4 w-4" />
              Add Department
            </button>
          }
        >
          {showDeptForm ? (
            <div className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface-card)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-[var(--ink)]">{editingDept ? "Edit Department" : "New Department"}</p>
                <button type="button" onClick={() => setShowDeptForm(false)}>
                  <X className="h-4 w-4 text-[var(--muted)]" />
                </button>
              </div>
              {deptError ? <InlineBanner variant="error" title="Save failed" message={deptError} className="mb-3" /> : null}
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Name *</label>
                  <input
                    className="institutional-input mt-1.5 w-full rounded-md px-4 py-2 outline-none"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Code</label>
                  <input
                    className="institutional-input mt-1.5 w-full rounded-md px-4 py-2 outline-none"
                    value={deptForm.code}
                    onChange={(e) => setDeptForm((f) => ({ ...f, code: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Description</label>
                  <input
                    className="institutional-input mt-1.5 w-full rounded-md px-4 py-2 outline-none"
                    value={deptForm.description}
                    onChange={(e) => setDeptForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={saveDept}
                  disabled={deptSaving || !deptForm.name.trim()}
                  className="primary-button rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {deptSaving ? "Saving…" : editingDept ? "Save Changes" : "Create Department"}
                </button>
                <button type="button" onClick={() => setShowDeptForm(false)} className="secondary-button rounded-md px-4 py-2 text-sm font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          <DataTable
            columns={[
              { key: "code", label: "Code", render: (row) => <span className="font-mono text-xs font-semibold text-[var(--accent)]">{row.code || "—"}</span> },
              { key: "name", label: "Department" },
              { key: "description", label: "Description", render: (row) => <span className="text-[var(--muted)]">{row.description || "—"}</span> },
              { key: "is_active", label: "Status", render: (row) => <StatusBadge status={row.is_active ? "Active" : "Inactive"} /> },
              {
                key: "actions",
                label: "",
                render: (row) =>
                  confirmDeleteDeptId === row.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--danger)]">Delete?</span>
                      <button
                        type="button"
                        onClick={() => void confirmDeleteDept(row.id)}
                        disabled={deletingDeptId === row.id}
                        className="rounded-md bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {deletingDeptId === row.id ? "…" : "Yes"}
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteDeptId(null)} className="secondary-button rounded-md px-3 py-1.5 text-xs font-semibold">
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEditDept(row)} className="secondary-button rounded-md px-3 py-1.5 text-xs font-semibold">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteDeptId(row.id)}
                        className="rounded-md border border-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white"
                      >
                        Delete
                      </button>
                    </div>
                  ),
              },
            ]}
            rows={workspace.departments}
            emptyMessage="No departments configured. Add one above."
          />
        </SectionCard>

        <SectionCard
          title="Branches"
          subtitle="Physical locations."
          action={
            <button type="button" onClick={openNewBranch} className="primary-button inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold">
              <Plus className="h-4 w-4" />
              Add Branch
            </button>
          }
        >
          {showBranchForm ? (
            <div className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface-card)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-[var(--ink)]">{editingBranch ? "Edit Branch" : "New Branch"}</p>
                <button type="button" onClick={() => setShowBranchForm(false)}>
                  <X className="h-4 w-4 text-[var(--muted)]" />
                </button>
              </div>
              {branchError ? <InlineBanner variant="error" title="Save failed" message={branchError} className="mb-3" /> : null}
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Name *</label>
                  <input
                    className="institutional-input mt-1.5 w-full rounded-md px-4 py-2 outline-none"
                    value={branchForm.name}
                    onChange={(e) => setBranchForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Code</label>
                  <input
                    className="institutional-input mt-1.5 w-full rounded-md px-4 py-2 outline-none"
                    value={branchForm.code}
                    onChange={(e) => setBranchForm((f) => ({ ...f, code: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">City</label>
                  <input
                    className="institutional-input mt-1.5 w-full rounded-md px-4 py-2 outline-none"
                    value={branchForm.city}
                    onChange={(e) => setBranchForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Country</label>
                  <input
                    className="institutional-input mt-1.5 w-full rounded-md px-4 py-2 outline-none"
                    value={branchForm.country}
                    onChange={(e) => setBranchForm((f) => ({ ...f, country: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Address</label>
                  <input
                    className="institutional-input mt-1.5 w-full rounded-md px-4 py-2 outline-none"
                    value={branchForm.address}
                    onChange={(e) => setBranchForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={saveBranch}
                  disabled={branchSaving || !branchForm.name.trim()}
                  className="primary-button rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {branchSaving ? "Saving…" : editingBranch ? "Save Changes" : "Create Branch"}
                </button>
                <button type="button" onClick={() => setShowBranchForm(false)} className="secondary-button rounded-md px-4 py-2 text-sm font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          <DataTable
            columns={[
              { key: "code", label: "Code", render: (row) => <span className="font-mono text-xs font-semibold text-[var(--accent)]">{row.code || "—"}</span> },
              { key: "name", label: "Branch" },
              { key: "city", label: "City", render: (row) => <span>{row.city || "—"}</span> },
              { key: "country", label: "Country", render: (row) => <span>{row.country || "—"}</span> },
              { key: "is_active", label: "Status", render: (row) => <StatusBadge status={row.is_active ? "Active" : "Inactive"} /> },
              {
                key: "actions",
                label: "",
                render: (row) =>
                  confirmDeleteBranchId === row.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--danger)]">Delete?</span>
                      <button
                        type="button"
                        onClick={() => void confirmDeleteBranch(row.id)}
                        disabled={deletingBranchId === row.id}
                        className="rounded-md bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {deletingBranchId === row.id ? "…" : "Yes"}
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteBranchId(null)} className="secondary-button rounded-md px-3 py-1.5 text-xs font-semibold">
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEditBranch(row)} className="secondary-button rounded-md px-3 py-1.5 text-xs font-semibold">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteBranchId(row.id)}
                        className="rounded-md border border-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white"
                      >
                        Delete
                      </button>
                    </div>
                  ),
              },
            ]}
            rows={workspace.branches}
            emptyMessage="No branches configured. Add one above."
          />
        </SectionCard>

        <SectionCard title="Approval Workflows" subtitle="Workflow templates.">
          <DataTable
            columns={[
              { key: "code", label: "Code", render: (row) => <span className="font-mono text-xs font-semibold text-[var(--accent)]">{row.code}</span> },
              { key: "name", label: "Workflow" },
              { key: "module_key", label: "Module" },
              { key: "is_active", label: "Status", render: (row) => <StatusBadge status={row.is_active ? "Active" : "Inactive"} /> },
              {
                key: "actions",
                label: "Focus",
                render: (row) => (
                  <button
                    type="button"
                    onClick={() => setSelectedWorkflowId(row.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${selectedWorkflowId === row.id ? "primary-button" : "secondary-button"}`}
                  >
                    Inspect
                  </button>
                ),
              },
            ]}
            rows={workspace.workflows}
            emptyMessage="No workflow templates are configured."
          />
        </SectionCard>
      </div>

      <aside className="space-y-6">
        {org ? (
          <DetailSectionCard title="Active Organization" subtitle={org.name}>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-[var(--surface-container)] px-4 py-3">
                <Building2 className="h-4 w-4 text-[var(--accent)]" />
                <div>
                  <p className="text-xs font-semibold text-[var(--muted)]">Legal Name</p>
                  <p className="text-sm font-semibold text-[var(--ink)]">{org.legal_name || org.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-[var(--surface-container)] px-4 py-3">
                <Layers className="h-4 w-4 text-[var(--accent)]" />
                <div>
                  <p className="text-xs font-semibold text-[var(--muted)]">Currency / Timezone</p>
                  <p className="text-sm font-semibold text-[var(--ink)]">{org.currency_code} · {org.timezone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-[var(--surface-container)] px-4 py-3">
                <GitBranch className="h-4 w-4 text-[var(--accent)]" />
                <div>
                  <p className="text-xs font-semibold text-[var(--muted)]">Structure</p>
                  <p className="text-sm font-semibold text-[var(--ink)]">{workspace.departments.length} dept · {workspace.branches.length} branches</p>
                </div>
              </div>
            </div>
          </DetailSectionCard>
        ) : null}

        <DetailSectionCard title="Workflow" subtitle={selectedWorkflow?.name ?? "No workflow selected"}>
          {selectedWorkflow ? <WorkflowDetail workflow={selectedWorkflow} /> : <p className="text-sm text-[var(--muted)]">Select a workflow to inspect it.</p>}
        </DetailSectionCard>
      </aside>
    </div>
  );
}

function WorkflowDetail({ workflow }: { workflow: EnterpriseWorkflowTemplate }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="headline-font text-lg font-bold tracking-[-0.03em] text-[var(--ink)]">{workflow.name}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">{workflow.description || "No workflow description provided."}</p>
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Steps</p>
        {workflow.steps.map((step) => (
          <div key={step.id} className="rounded-xl border border-[var(--surface-container)] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{step.sequence}. {step.name}</p>
              <StatusBadge status={step.role_name || "Unassigned"} />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {step.minimum_amount || step.maximum_amount
                ? `Thresholds: ${step.minimum_amount ?? 0} to ${step.maximum_amount ?? "No max"}`
                : "Applies to all request amounts."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
