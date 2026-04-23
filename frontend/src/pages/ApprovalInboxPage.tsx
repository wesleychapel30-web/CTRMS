import { Download, ExternalLink, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { DetailSectionCard } from "../components/DetailSectionCard";
import { EnterpriseAttachmentPanel } from "../components/EnterpriseAttachmentPanel";
import { EnterpriseTimeline } from "../components/EnterpriseTimeline";
import { InlineBanner, StatePanel } from "../components/FeedbackStates";
import { FilterBar } from "../components/FilterBar";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { WorkflowActionBar } from "../components/WorkflowActionBar";
import { WorkspaceTabs } from "../components/WorkspaceTabs";
import { useToast } from "../context/ToastContext";
import {
  addEnterpriseProcurementApprovalComment,
  addFinanceInvoiceApprovalComment,
  addFinancePaymentApprovalComment,
  approveEnterpriseProcurementRequest,
  approveFinanceInvoice,
  approveFinancePaymentRequest,
  fetchApprovalInbox,
  fetchFinanceWorkspace,
  fetchProcurementWorkspace,
  rejectEnterpriseProcurementRequest,
  rejectFinancePaymentRequest
} from "../lib/api";
import {
  buildEnterpriseExportFilename,
  deriveApprovalInboxStage,
  downloadCsvFile,
  getApprovalItemTypeLabel,
  getApprovalPriority,
  type WorkflowStageKey
} from "../lib/enterpriseWorkflow";
import { formatCurrency, formatDateTime } from "../lib/format";
import type {
  ApprovalInbox,
  ApprovalInboxItem,
  EnterpriseAttachmentRecord,
  EnterpriseAuditEntry,
  EnterpriseWorkflowAction,
  FinanceWorkspace,
  ProcurementWorkspace,
  Stat
} from "../types";

type ApprovalQueueTab = "all" | "director_review" | "finance_review" | "payment_approval";
type InspectorTab = "overview" | "approval" | "timeline" | "attachments";
type ActingAction = EnterpriseWorkflowAction | "comment";

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unable to load approvals";
}

function isToday(value: string | null | undefined) {
  if (!value) {
    return false;
  }
  const target = new Date(value);
  const today = new Date();
  return target.toDateString() === today.toDateString();
}

function matchesTodayEvent(entries: EnterpriseAuditEntry[], matcher: RegExp) {
  return entries.some((entry) => isToday(entry.created_at) && matcher.test(`${entry.label} ${entry.title}`));
}

function priorityPillClass(label: string) {
  if (label === "Urgent") {
    return "bg-rose-100 text-rose-800";
  }
  if (label === "High") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-[var(--accent-soft)] text-[var(--accent)]";
}

function queueTabLabel(tab: ApprovalQueueTab) {
  if (tab === "director_review") {
    return "Director Review";
  }
  if (tab === "finance_review") {
    return "Finance Review";
  }
  if (tab === "payment_approval") {
    return "Payment Approval";
  }
  return "All Approvals";
}

export function ApprovalInboxPage() {
  const toast = useToast();
  const [inbox, setInbox] = useState<ApprovalInbox | null>(null);
  const [procurementWorkspace, setProcurementWorkspace] = useState<ProcurementWorkspace | null>(null);
  const [financeWorkspace, setFinanceWorkspace] = useState<FinanceWorkspace | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [queueTab, setQueueTab] = useState<ApprovalQueueTab>("all");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("overview");
  const [decisionNote, setDecisionNote] = useState("");
  const [actingAction, setActingAction] = useState<{ id: string; action: ActingAction } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = async () => {
    setIsLoading(true);
    try {
      const [nextInbox, nextProcurementWorkspace, nextFinanceWorkspace] = await Promise.all([
        fetchApprovalInbox(),
        fetchProcurementWorkspace(),
        fetchFinanceWorkspace()
      ]);
      setInbox(nextInbox);
      setProcurementWorkspace(nextProcurementWorkspace);
      setFinanceWorkspace(nextFinanceWorkspace);
      setSelectedItemId((current) => current ?? nextInbox.items[0]?.id ?? null);
      setError(null);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setDecisionNote("");
    setInspectorTab("overview");
  }, [selectedItemId]);

  const currencyCode = procurementWorkspace?.organization?.currency_code ?? financeWorkspace?.organization?.currency_code ?? "TZS";
  const procurementRecords = useMemo(
    () => new Map((procurementWorkspace?.requests ?? []).map((record) => [record.id, record])),
    [procurementWorkspace?.requests]
  );
  const financeInvoiceRecords = useMemo(
    () => new Map((financeWorkspace?.invoices ?? []).map((record) => [record.id, record])),
    [financeWorkspace?.invoices]
  );
  const financePaymentRecords = useMemo(
    () => new Map((financeWorkspace?.payment_requests ?? []).map((record) => [record.id, record])),
    [financeWorkspace?.payment_requests]
  );

  const baseFilteredItems = useMemo(() => {
    const items = inbox?.items ?? [];
    return items.filter((item) => {
      const haystack = `${item.record_number} ${item.title} ${item.subtitle} ${item.department_name} ${item.branch_name} ${item.requested_by_name}`.toLowerCase();
      const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
      const matchesModule = moduleFilter === "all" || item.module_key === moduleFilter;
      const matchesBranch = branchFilter === "all" || item.branch_name === branchFilter;
      const createdDate = item.created_at.slice(0, 10);
      const matchesDateFrom = !dateFrom || createdDate >= dateFrom;
      const matchesDateTo = !dateTo || createdDate <= dateTo;
      return matchesQuery && matchesModule && matchesBranch && matchesDateFrom && matchesDateTo;
    });
  }, [branchFilter, dateFrom, dateTo, inbox?.items, moduleFilter, query]);

  const queueTabs = useMemo(
    () => [
      { key: "all" as const, label: "All Approvals", badge: baseFilteredItems.length },
      {
        key: "director_review" as const,
        label: "Director Review",
        badge: baseFilteredItems.filter((item) => deriveApprovalInboxStage(item).key === "director_review").length
      },
      {
        key: "finance_review" as const,
        label: "Finance Review",
        badge: baseFilteredItems.filter((item) => deriveApprovalInboxStage(item).key === "finance_review").length
      },
      {
        key: "payment_approval" as const,
        label: "Payment Approval",
        badge: baseFilteredItems.filter((item) => deriveApprovalInboxStage(item).key === "payment_approval").length
      }
    ],
    [baseFilteredItems]
  );

  const queueItems = useMemo(() => {
    if (queueTab === "all") {
      return baseFilteredItems;
    }
    return baseFilteredItems.filter((item) => deriveApprovalInboxStage(item).key === queueTab);
  }, [baseFilteredItems, queueTab]);

  const selectedItem = queueItems.find((item) => item.id === selectedItemId) ?? queueItems[0] ?? null;
  const selectedStage = selectedItem ? deriveApprovalInboxStage(selectedItem) : null;
  const selectedProcurementRecord =
    selectedItem?.entity_type === "procurement_request" ? procurementRecords.get(selectedItem.record_id) ?? null : null;
  const selectedInvoiceRecord =
    selectedItem?.entity_type === "finance_invoice" ? financeInvoiceRecords.get(selectedItem.record_id) ?? null : null;
  const selectedPaymentRecord =
    selectedItem?.entity_type === "payment_request" ? financePaymentRecords.get(selectedItem.record_id) ?? null : null;
  const selectedTimeline =
    selectedProcurementRecord?.approval_history?.length
      ? selectedProcurementRecord.approval_history
      : selectedInvoiceRecord?.approval_history?.length
        ? selectedInvoiceRecord.approval_history
        : selectedPaymentRecord?.approval_history?.length
          ? selectedPaymentRecord.approval_history
          : selectedProcurementRecord?.audit_timeline ??
            selectedInvoiceRecord?.audit_timeline ??
            selectedPaymentRecord?.audit_timeline ??
            [];
  const selectedAttachments: EnterpriseAttachmentRecord[] =
    selectedProcurementRecord?.attachments ?? selectedInvoiceRecord?.attachments ?? selectedPaymentRecord?.attachments ?? [];

  const approvedToday = useMemo(() => {
    const procurementCount = (procurementWorkspace?.requests ?? []).filter((record) =>
      matchesTodayEvent(record.approval_history?.length ? record.approval_history : record.audit_timeline, /approve|completed/i)
    ).length;
    const invoiceCount = (financeWorkspace?.invoices ?? []).filter((record) =>
      matchesTodayEvent(record.approval_history?.length ? record.approval_history : record.audit_timeline, /approve|completed/i)
    ).length;
    const paymentCount = (financeWorkspace?.payment_requests ?? []).filter((record) =>
      matchesTodayEvent(record.approval_history?.length ? record.approval_history : record.audit_timeline, /approve|completed/i)
    ).length;
    return procurementCount + invoiceCount + paymentCount;
  }, [financeWorkspace?.invoices, financeWorkspace?.payment_requests, procurementWorkspace?.requests]);

  const rejectedToday = useMemo(() => {
    const procurementCount = (procurementWorkspace?.requests ?? []).filter((record) =>
      matchesTodayEvent(record.approval_history?.length ? record.approval_history : record.audit_timeline, /reject/i)
    ).length;
    const invoiceCount = (financeWorkspace?.invoices ?? []).filter((record) =>
      matchesTodayEvent(record.approval_history?.length ? record.approval_history : record.audit_timeline, /reject/i)
    ).length;
    const paymentCount = (financeWorkspace?.payment_requests ?? []).filter((record) =>
      matchesTodayEvent(record.approval_history?.length ? record.approval_history : record.audit_timeline, /reject/i)
    ).length;
    return procurementCount + invoiceCount + paymentCount;
  }, [financeWorkspace?.invoices, financeWorkspace?.payment_requests, procurementWorkspace?.requests]);

  const urgentApprovals = baseFilteredItems.filter((item) => getApprovalPriority(item).label === "Urgent").length;
  const highValueApprovals = baseFilteredItems.filter((item) => Number(item.amount || 0) >= 10_000_000).length;
  const stats: Stat[] = [
    { label: "Pending", value: String(baseFilteredItems.length), change: "Awaiting your decision", tone: "accent" },
    { label: "Urgent", value: String(urgentApprovals), change: "Aged items", tone: "danger" },
    { label: "High-Value", value: String(highValueApprovals), change: `Above 10M ${currencyCode}`, tone: "warning" },
    { label: "Approved Today", value: String(approvedToday), change: "Processed", tone: "success" },
    { label: "Rejected Today", value: String(rejectedToday), change: "Denied", tone: "danger" }
  ];

  const saveComment = async () => {
    if (!selectedItem || !decisionNote.trim()) {
      toast.warning("Add a short note before saving it to the approval history.");
      return;
    }
    setActingAction({ id: selectedItem.id, action: "comment" });
    try {
      if (selectedItem.entity_type === "procurement_request") {
        await addEnterpriseProcurementApprovalComment(selectedItem.record_id, decisionNote.trim());
      } else if (selectedItem.entity_type === "finance_invoice") {
        await addFinanceInvoiceApprovalComment(selectedItem.record_id, decisionNote.trim());
      } else {
        await addFinancePaymentApprovalComment(selectedItem.record_id, decisionNote.trim());
      }
      toast.success("Approval note saved.");
      setDecisionNote("");
      await load();
      setInspectorTab("timeline");
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setActingAction(null);
    }
  };

  const handleAction = async (item: ApprovalInboxItem, action: EnterpriseWorkflowAction) => {
    setActingAction({ id: item.id, action });
    try {
      if (action === "approve") {
        if (item.entity_type === "procurement_request") {
          await approveEnterpriseProcurementRequest(item.record_id, decisionNote.trim());
        } else if (item.entity_type === "finance_invoice") {
          if (decisionNote.trim()) {
            await addFinanceInvoiceApprovalComment(item.record_id, decisionNote.trim());
          }
          await approveFinanceInvoice(item.record_id);
        } else {
          if (decisionNote.trim()) {
            await addFinancePaymentApprovalComment(item.record_id, decisionNote.trim());
          }
          await approveFinancePaymentRequest(item.record_id);
        }
        toast.success(`${item.record_number} moved to the next stage.`);
        setDecisionNote("");
      }

      if (action === "reject") {
        if (!decisionNote.trim()) {
          toast.warning("Add a reason before rejecting the selected record.");
          return;
        }
        if (item.entity_type === "procurement_request") {
          await rejectEnterpriseProcurementRequest(item.record_id, decisionNote.trim());
        } else {
          await rejectFinancePaymentRequest(item.record_id, decisionNote.trim());
        }
        toast.success(`${item.record_number} was rejected.`);
        setDecisionNote("");
      }

      await load();
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setActingAction(null);
    }
  };

  if (isLoading || !inbox || !procurementWorkspace || !financeWorkspace) {
    return <StatePanel variant="loading" title="Loading approvals" message="Loading approval items." />;
  }

  if (error) {
    return <StatePanel variant="error" title="Approvals unavailable" message={error} actionLabel="Retry" onAction={() => void load()} />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        <SectionCard
          testId="approval-workspace-board"
          title="Approval Inbox"
          subtitle="Pending decisions."
          action={
            <button
              type="button"
              onClick={() =>
                downloadCsvFile(
                  buildEnterpriseExportFilename("approval-workspace"),
                  ["Record", "Type", "Department", "Amount", "Priority", "Stage", "Submitted"],
                  queueItems.map((item) => [
                    item.record_number,
                    getApprovalItemTypeLabel(item),
                    item.department_name,
                    item.amount,
                    getApprovalPriority(item).label,
                    deriveApprovalInboxStage(item).label,
                    item.created_at
                  ])
                )
              }
              className="secondary-button inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          }
        >
          <div className="space-y-5">
            <WorkspaceTabs tabs={queueTabs} activeTab={queueTab} onChange={setQueueTab} />

            <FilterBar className="mb-0">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by record, title, department, or requester"
                className="institutional-input rounded-md px-4 py-2.5 outline-none"
              />
              <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} className="institutional-input rounded-md px-4 py-2.5 outline-none">
                <option value="all">All modules</option>
                {inbox.filters.modules.map((moduleKey) => (
                  <option key={moduleKey} value={moduleKey}>
                    {moduleKey}
                  </option>
                ))}
              </select>
              <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className="institutional-input rounded-md px-4 py-2.5 outline-none">
                <option value="all">All branches</option>
                {inbox.filters.branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
              <div className="table-stat flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-[var(--muted)]">
                <Filter className="h-4 w-4" />
                Showing {queueItems.length} item(s)
              </div>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="institutional-input rounded-md px-4 py-2.5 outline-none" />
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="institutional-input rounded-md px-4 py-2.5 outline-none" />
            </FilterBar>

            {!queueItems.length ? (
              <InlineBanner
                variant="info"
                title="No items in this queue"
                message="Try another queue or filter."
              />
            ) : null}

            <DataTable
              columns={[
                { key: "record_number", label: "Request ID", render: (row) => <span className="font-semibold">{row.record_number}</span> },
                { key: "department_name", label: "Department", render: (row) => row.department_name || "Unassigned" },
                {
                  key: "title",
                  label: "Title",
                  render: (row) => (
                    <div className="min-w-[16rem]">
                      <p className="font-semibold text-[var(--ink)]">{row.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{row.subtitle}</p>
                    </div>
                  )
                },
                { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount, currencyCode) },
                { key: "type", label: "Type", render: (row) => getApprovalItemTypeLabel(row) },
                { key: "created_at", label: "Submitted", render: (row) => formatDateTime(row.created_at) },
                {
                  key: "priority",
                  label: "Priority",
                  render: (row) => {
                    const priority = getApprovalPriority(row);
                    return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${priorityPillClass(priority.label)}`}>{priority.label}</span>;
                  }
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <div className="space-y-2">
                      <StatusBadge status={deriveApprovalInboxStage(row).label} />
                      <p className="text-xs text-[var(--muted)]">{row.status_display}</p>
                    </div>
                  )
                },
                {
                  key: "actions",
                  label: "Actions",
                  render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedItemId(row.id)}
                        className="primary-button rounded-sm px-3 py-1.5 text-xs font-semibold"
                      >
                        Inspect
                      </button>
                      <Link to={row.href} className="secondary-button inline-flex items-center gap-1 rounded-sm px-3 py-1.5 text-xs font-semibold">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </Link>
                    </div>
                  )
                }
              ]}
              rows={queueItems}
              emptyMessage="No pending approvals are assigned to this queue."
            />
          </div>
        </SectionCard>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <DetailSectionCard
          testId="approval-record-inspector"
          title="Decision"
          subtitle={selectedItem ? `${selectedItem.record_number} · ${selectedStage?.label ?? selectedItem.status_display}` : "No approval selected"}
        >
          {selectedItem ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-[var(--surface-low)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Category</p>
                  <p className="mt-2 text-sm font-bold text-[var(--ink)]">{getApprovalItemTypeLabel(selectedItem)}</p>
                </div>
                <div className="rounded-lg bg-[var(--surface-low)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Amount (TZS)</p>
                  <p className="mt-2 text-base font-bold text-[var(--ink)]">{formatCurrency(selectedItem.amount, currencyCode)}</p>
                </div>
              </div>

              <WorkspaceTabs
                tabs={[
                  { key: "overview", label: "Overview" },
                  { key: "approval", label: "Decision" },
                  { key: "attachments", label: "Files", badge: selectedAttachments.length || null },
                  { key: "timeline", label: "History" }
                ]}
                activeTab={inspectorTab}
                onChange={setInspectorTab}
              />

              {inspectorTab === "overview" ? (
                <div className="space-y-4">
                  <div>
                    <p className="headline-font text-base font-bold tracking-[-0.02em] text-[var(--ink)]">{selectedItem.title}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">{selectedProcurementRecord?.justification || selectedItem.subtitle}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-[var(--line)] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Step</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{selectedStage?.label}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Priority</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{getApprovalPriority(selectedItem).label}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Dept</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{selectedItem.department_name || "Unassigned"}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Date</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{formatDateTime(selectedItem.created_at)}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--line)] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Requested By</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{selectedItem.requested_by_name || "System"}</p>
                    {selectedItem.branch_name ? <p className="mt-1 text-xs text-[var(--muted)]">{selectedItem.branch_name}</p> : null}
                  </div>
                </div>
              ) : null}

              {inspectorTab === "approval" ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-[var(--surface-low)] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Actionable Step</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{selectedItem.pending_step_name || selectedStage?.label || "Approval review"}</p>
                  </div>
                  <WorkflowActionBar
                    actions={selectedItem.available_actions}
                    busyAction={
                      actingAction?.id === selectedItem.id && actingAction.action !== "comment"
                        ? (actingAction.action as EnterpriseWorkflowAction)
                        : null
                    }
                    testIdPrefix="approval-inspector-action"
                    onAction={(action) => void handleAction(selectedItem, action)}
                    emptyMessage="No decision actions are available on this record."
                  />
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Comment</label>
                    <textarea
                      value={decisionNote}
                      onChange={(event) => setDecisionNote(event.target.value)}
                      rows={3}
                      placeholder="Add a short approval note or rejection reason."
                      className="institutional-input w-full rounded-xl px-4 py-3 outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => void saveComment()}
                      disabled={actingAction?.id === selectedItem.id || !decisionNote.trim()}
                      className="secondary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      {actingAction?.id === selectedItem.id && actingAction.action === "comment" ? "Saving..." : "Save Note"}
                    </button>
                    <Link to={selectedItem.href} className="text-xs font-semibold text-[var(--accent)]">
                      Open full record
                    </Link>
                  </div>
                </div>
              ) : null}

              {inspectorTab === "timeline" ? (
                <EnterpriseTimeline entries={selectedTimeline} emptyMessage="Approval history will appear here." />
              ) : null}

              {inspectorTab === "attachments" ? (
                <EnterpriseAttachmentPanel attachments={selectedAttachments} emptyMessage="No attachments available." />
              ) : null}
            </div>
          ) : (
            <StatePanel variant="empty" title="No approval selected" message="Select a record to review." compact />
          )}
        </DetailSectionCard>
      </aside>
    </div>
  );
}
