import { CheckCircle2, CircleHelp, Download, FileText, UserCheck, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { AttachmentPreviewPanel } from "../components/AttachmentPreviewPanel";
import { ContextActionPrompt, type PromptAnchor } from "../components/ContextActionPrompt";
import { DetailSectionCard } from "../components/DetailSectionCard";
import { StatePanel } from "../components/FeedbackStates";
import { RecordChatter } from "../components/RecordChatter";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { useSession } from "../context/SessionContext";
import { useToast } from "../context/ToastContext";
import {
  addRequestTimelineEntry,
  addRequestPayment,
  approveRequest,
  buildAttachmentPreviewUrl,
  cancelRequest,
  completeRequestPayment,
  fetchRequest,
  financeMarkPendingPayment,
  financeRaiseQuery,
  financeStartProcessing,
  markRequestPaid,
  rejectRequest,
  requestClarification,
  resolveAssetUrl,
  restoreRequest,
  reverseRequest,
  startRequestReview,
  uploadRequestDocument
} from "../lib/api";
import { formatCurrency, formatDate, formatDateTime } from "../lib/format";
import { getRequestActionVisibility } from "../lib/workflowMatrix";
import type { RequestRecord } from "../types";

type RequestWorkflowAction =
  | "start-review"
  | "approve"
  | "reject"
  | "request-clarification"
  | "finance-start-processing"
  | "finance-raise-query"
  | "finance-pending-payment"
  | "record-payment"
  | "add-payment"
  | "mark-completed"
  | "cancel"
  | "restore"
  | "reverse";

function getRequestDocumentPreviewUrl(document: { download_url?: string; document: string }) {
  return buildAttachmentPreviewUrl(document.download_url, document.document);
}

function getRequestDocumentDownloadUrl(document: { download_url?: string; document: string }) {
  return resolveAssetUrl(document.download_url ?? document.document);
}

export function RequestDetailsPage() {
  const { requestId } = useParams();
  const { hasPermission, hasRole } = useSession();
  const toast = useToast();
  const [requestRecord, setRequestRecord] = useState<RequestRecord | null>(null);
  const [notes, setNotes] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [recordPaymentAmount, setRecordPaymentAmount] = useState("");
  const [additionalPaymentAmount, setAdditionalPaymentAmount] = useState("");
  const [completionAmount, setCompletionAmount] = useState("");
  const [uploadType, setUploadType] = useState("Supporting Document");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const [financeNotes, setFinanceNotes] = useState("");
  const [previewFile, setPreviewFile] = useState<{ title: string; fileName?: string; fileUrl: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<RequestWorkflowAction | null>(null);
  const [pendingActionAnchor, setPendingActionAnchor] = useState<PromptAnchor | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [isTimelineSubmitting, setIsTimelineSubmitting] = useState(false);
  const [isUploadSubmitting, setIsUploadSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadRequest = async () => {
    if (!requestId) {
      return;
    }
    try {
      setIsLoading(true);
      const data = await fetchRequest(requestId);
      setLoadError(null);
      setRequestRecord(data);
      setApprovedAmount(data.approved_amount ? String(data.approved_amount) : "");
      const suggestedRecordAmount =
        data.status === "approved"
          ? (data.approved_amount ?? data.amount_requested)
          : (data.disbursed_amount ?? data.approved_amount ?? data.amount_requested);
      setRecordPaymentAmount(suggestedRecordAmount !== null && suggestedRecordAmount !== undefined ? String(suggestedRecordAmount) : "");
      setCompletionAmount(data.approved_amount !== null && data.approved_amount !== undefined ? String(data.approved_amount) : "");
      setAdditionalPaymentAmount("");
      setNotes(data.review_notes ?? "");
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "Unable to load request");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequest();
  }, [requestId]);

  if (loadError) {
    return <StatePanel variant="error" title="Request unavailable" message={loadError} actionLabel="Retry" onAction={() => void loadRequest()} />;
  }

  if (isLoading || !requestRecord) {
    return <StatePanel variant="loading" title="Loading request" message="Loading details and attachments." />;
  }

  const isDirector = hasRole("director");
  const canApprove = isDirector && hasPermission("request:approve");
  const canReject = isDirector && hasPermission("request:reject");
  const canStartReview = hasPermission("request:update_all") || hasPermission("request:update_own");
  const canDecide = canApprove || canReject;
  const canProcessFinance = hasPermission("payment:record");
  const canRecordPayment = hasPermission("payment:record");
  const canUploadDocuments = hasPermission("request:upload_all") || hasPermission("request:upload_own");
  const canCancel = hasPermission("request:cancel");
  const canRestore = hasPermission("request:restore");
  const canReverse = hasPermission("request:reverse");
  const visibility = getRequestActionVisibility(requestRecord.status);
  const showStartReview = canStartReview && visibility.showStartReview;
  const showApprove = canApprove && visibility.showApprove;
  const showReject = canReject && visibility.showReject;
  const showRequestClarification = canApprove && visibility.showRequestClarification;
  const showFinanceStartProcessing = canProcessFinance && visibility.showFinanceStartProcessing;
  const showFinanceRaiseQuery = canProcessFinance && visibility.showFinanceRaiseQuery;
  const showFinancePendingPayment = canProcessFinance && visibility.showFinancePendingPayment;
  const showRecordPayment = canRecordPayment && visibility.showRecordPayment;
  const showAddPayment = canRecordPayment && visibility.showAddPayment;
  const showMarkCompleted = canRecordPayment && visibility.showMarkCompleted;
  const showCancel = canCancel && visibility.showCancel;
  const showRestore = canRestore && visibility.showRestore;
  const showReverse = canReverse && visibility.showReverse;
  const showFinancePanel = showFinanceStartProcessing || showFinanceRaiseQuery || showFinancePendingPayment;
  const canUploadForStatus = !["cancelled", "archived"].includes(requestRecord.status);
  const remainingBalance = (requestRecord.approved_amount ?? 0) - (requestRecord.disbursed_amount ?? 0);
  const canComposeTimeline = hasRole("director") || hasRole("admin");

  const actionSuccessMessages: Record<RequestWorkflowAction, { title: string; message: string }> = {
    "start-review": { title: "Request updated", message: "Request moved to under review." },
    approve: { title: "Request approved", message: "Request approved and forwarded to Finance." },
    reject: { title: "Request rejected", message: "Request rejected successfully." },
    "request-clarification": { title: "Clarification requested", message: "Request returned for clarification." },
    "finance-start-processing": { title: "Finance processing", message: "Finance processing started." },
    "finance-raise-query": { title: "Query raised", message: "Finance query raised." },
    "finance-pending-payment": { title: "Payment scheduled", message: "Request moved to pending payment." },
    "record-payment": { title: "Payment recorded", message: "Payment recorded successfully." },
    "add-payment": { title: "Payment recorded", message: "Additional payment recorded successfully." },
    "mark-completed": { title: "Payment completed", message: "Payment marked as completed." },
    cancel: { title: "Request updated", message: "Request cancelled." },
    restore: { title: "Request updated", message: "Request restored." },
    reverse: { title: "Decision reverted", message: "Decision reverted successfully." },
  };

  const runAction = async (action: RequestWorkflowAction) => {
    if (!requestRecord) {
      return;
    }

    setIsActionSubmitting(true);
    try {
      if (action === "start-review") {
        await startRequestReview(requestRecord.id, adminComment || notes);
      } else if (action === "approve") {
        await approveRequest(requestRecord.id, Number(approvedAmount || requestRecord.amount_requested), notes);
      } else if (action === "reject") {
        await rejectRequest(requestRecord.id, notes);
      } else if (action === "request-clarification") {
        await requestClarification(requestRecord.id, notes);
      } else if (action === "finance-start-processing") {
        await financeStartProcessing(requestRecord.id, financeNotes);
      } else if (action === "finance-raise-query") {
        await financeRaiseQuery(requestRecord.id, financeNotes);
      } else if (action === "finance-pending-payment") {
        await financeMarkPendingPayment(
          requestRecord.id,
          financeNotes,
          approvedAmount.trim() ? Number(approvedAmount) : undefined
        );
      } else if (action === "record-payment") {
        await markRequestPaid(
          requestRecord.id,
          paymentMethod,
          paymentReference,
          recordPaymentAmount.trim() ? Number(recordPaymentAmount) : undefined
        );
      } else if (action === "add-payment") {
        await addRequestPayment(
          requestRecord.id,
          paymentMethod,
          paymentReference,
          Number(additionalPaymentAmount)
        );
      } else if (action === "mark-completed") {
        await completeRequestPayment(
          requestRecord.id,
          paymentMethod,
          paymentReference,
          completionAmount.trim() ? Number(completionAmount) : undefined
        );
      } else if (action === "cancel") {
        await cancelRequest(requestRecord.id, adminComment);
      } else if (action === "restore") {
        await restoreRequest(requestRecord.id, adminComment);
      } else if (action === "reverse") {
        await reverseRequest(requestRecord.id, adminComment);
      }
      await loadRequest();
      const success = actionSuccessMessages[action];
      toast.success(success.message, success.title);
      setPendingAction(null);
      setPendingActionAnchor(null);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to update request workflow");
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const openActionPrompt = (action: RequestWorkflowAction, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setPendingActionAnchor({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height
    });
    setPendingAction(action);
  };

  const submitTimelineEntry = async (payload: { mode: "comment" | "internal_note"; body: string }) => {
    if (!requestRecord) {
      return;
    }
    setIsTimelineSubmitting(true);
    try {
      await addRequestTimelineEntry(requestRecord.id, payload);
      await loadRequest();
      toast.success(
        payload.mode === "internal_note" ? "Internal note saved." : "Comment added successfully.",
        payload.mode === "internal_note" ? "Note saved" : "Comment added"
      );
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to save note");
      throw reason;
    } finally {
      setIsTimelineSubmitting(false);
    }
  };

  const actionLabel = (() => {
    if (!pendingAction) return "";
    if (pendingAction === "start-review") return "Move To Review";
    if (pendingAction === "approve") return "Approve Request";
    if (pendingAction === "reject") return "Reject Request";
    if (pendingAction === "request-clarification") return "Request Clarification";
    if (pendingAction === "finance-start-processing") return "Start Finance Processing";
    if (pendingAction === "finance-raise-query") return "Raise Finance Query";
    if (pendingAction === "finance-pending-payment") return "Schedule Payment";
    if (pendingAction === "record-payment") return "Record Payment";
    if (pendingAction === "add-payment") return "Add Payment";
    if (pendingAction === "mark-completed") return "Mark Completed";
    if (pendingAction === "cancel") return "Cancel Request";
    if (pendingAction === "restore") return "Restore Request";
    return "Revert Decision";
  })();

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 space-y-4 lg:col-span-8">
        <DetailSectionCard title="Applicant Information">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Name" value={requestRecord.applicant_name} />
            <Field label="Phone" value={requestRecord.applicant_phone} />
            <Field label="Email" value={requestRecord.applicant_email} />
            <Field label="Organization" value={requestRecord.applicant_organization || "N/A"} />
            <Field label="Role" value={requestRecord.applicant_role || "N/A"} />
            <Field label="Region" value={requestRecord.applicant_region || "N/A"} />
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="Request Information">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Request ID" value={requestRecord.request_id} />
            <Field label="Category" value={requestRecord.category_display} />
            <Field label="Current Status" value={<StatusBadge status={requestRecord.status_display} />} />
            <Field label="Amount Requested" value={formatCurrency(requestRecord.amount_requested)} />
            <Field label="Beneficiaries" value={requestRecord.number_of_beneficiaries ?? "N/A"} />
            <Field label="Location" value={requestRecord.address} />
          </div>
          <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--surface-low)] p-3 text-sm leading-6 text-[var(--ink)]">
            <p className="headline-font text-sm font-bold tracking-[-0.02em] text-[var(--ink)]">{requestRecord.title || "Untitled request"}</p>
            <p className="mt-1.5 text-xs text-[var(--muted)]">{requestRecord.description}</p>
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="Attachments">
          <div className="space-y-3">
            {requestRecord.documents.length ? (
              requestRecord.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-low)] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-sm bg-[var(--surface-card)] p-2.5 text-[var(--accent)]">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--ink)]">{doc.document_type}</p>
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">{formatDateTime(doc.uploaded_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewFile({
                          title: doc.document_type,
                          fileName: doc.filename,
                          fileUrl: getRequestDocumentPreviewUrl(doc)
                        })
                      }
                      className="rounded-sm bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
                    >
                      Preview
                    </button>
                    <a
                      href={getRequestDocumentDownloadUrl(doc)}
                      target="_blank"
                      rel="noreferrer"
                      className="primary-button inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-semibold"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No request documents uploaded yet.</p>
            )}
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="Timeline" subtitle="Comments and status changes.">
          <RecordChatter
            title="Record History"
            subtitle="Permanent comments and workflow events."
            entries={requestRecord.timeline_entries ?? []}
            emptyMessage="No request history is available yet."
            canAddComment={canComposeTimeline}
            canAddInternalNote={canComposeTimeline}
            isSubmitting={isTimelineSubmitting}
            onSubmit={submitTimelineEntry}
          />
        </DetailSectionCard>
      </div>

      <div className="col-span-12 space-y-4 lg:col-span-4">
        <section className="rounded-xl border border-[#41506a] bg-[#0d1828] p-4 text-white shadow-[0_14px_40px_rgba(7,18,34,0.30)]">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1b2a43] text-[#5e98ff]">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="headline-font text-base font-extrabold tracking-[-0.04em] text-white">Reviewer Actions</h3>
            </div>
          </div>
          <div className="my-3 h-px bg-[#29374e]" />
          {canDecide || showStartReview ? (
            <div className="space-y-3">
              {showStartReview ? (
                <button
                  type="button"
                  disabled={isActionSubmitting}
                  onClick={(event) => openActionPrompt("start-review", event.currentTarget)}
                  className="w-full rounded-sm border border-[#3a4455] bg-[#1d2636] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#263247] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isActionSubmitting && pendingAction === "start-review" ? "Processing..." : "Move To Under Review"}
                </button>
              ) : null}
              <label className="block space-y-1.5">
                <span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#b6bed6]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#5e98ff]" />
                  <span>Approved amount</span>
                </span>
                <div className="flex items-center rounded-lg border border-[#4177e8] bg-[#101d30] p-1.5 shadow-[0_0_0_1px_rgba(65,119,232,0.12),0_8px_20px_rgba(15,54,126,0.14)]">
                  <span className="grid h-9 w-12 shrink-0 place-items-center rounded-md bg-[#243149] text-sm font-extrabold text-white">
                    TZS
                  </span>
                  <input
                    value={approvedAmount}
                    onChange={(event) => setApprovedAmount(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-2.5 py-1 text-lg font-extrabold tracking-[-0.04em] text-white outline-none placeholder:text-[#8aa4d6] focus:ring-0"
                    placeholder="0.00"
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label="Approved amount"
                  />
                </div>
              </label>
              <label className="block space-y-1.5">
                <span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#b6bed6]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#5e98ff]" />
                  <span>Decision comments</span>
                </span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-lg border border-[#34435a] bg-[#101d30] px-3 py-2 text-sm text-white outline-none placeholder:text-[#9aa7c7] focus:border-[#5e98ff] focus:ring-0"
                  placeholder="Optional comments for the record"
                  aria-label="Decision comments"
                />
              </label>
              {showApprove || showReject || showRequestClarification ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {showApprove ? (
                    <button
                      type="button"
                      disabled={isActionSubmitting}
                      onClick={(event) => openActionPrompt("approve", event.currentTarget)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#5e98ff] bg-gradient-to-br from-[#255bd5] to-[#193b96] px-3 py-2.5 text-xs font-extrabold text-white shadow-[0_8px_20px_rgba(37,91,213,0.22)] transition hover:translate-y-[-1px] hover:from-[#2f68eb] hover:to-[#2245a7] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4 text-[#9cc5ff]" />
                      {isActionSubmitting && pendingAction === "approve" ? "Processing..." : "Approve Request"}
                    </button>
                  ) : null}
                  {showReject ? (
                    <button
                      type="button"
                      disabled={isActionSubmitting}
                      onClick={(event) => openActionPrompt("reject", event.currentTarget)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#ff5454] bg-[#141d2b] px-3 py-2.5 text-xs font-extrabold text-[#ff5a5a] transition hover:translate-y-[-1px] hover:bg-[#ff5454]/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      {isActionSubmitting && pendingAction === "reject" ? "Processing..." : "Reject Request"}
                    </button>
                  ) : null}
                  {showRequestClarification ? (
                    <button
                      type="button"
                      disabled={isActionSubmitting}
                      onClick={(event) => openActionPrompt("request-clarification", event.currentTarget)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#b58a13] bg-[#141d2b] px-3 py-2.5 text-xs font-extrabold text-[#ffdc5c] transition hover:translate-y-[-1px] hover:bg-[#ffdc5c]/10 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                    >
                      <CircleHelp className="h-4 w-4" />
                      {isActionSubmitting && pendingAction === "request-clarification" ? "Processing..." : "Return for Clarification"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-4 text-sm text-[var(--sidebar-text)]/70">
                  Decision actions are not available in the current status.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-6 rounded-sm bg-white/5 px-4 py-4 text-sm text-[var(--sidebar-text)]/70">
              Only the Director can approve or reject requests.
            </p>
          )}
        </section>

        {showFinancePanel ? (
          <section className="surface-panel rounded-xl p-4">
            <h3 className="text-sm font-bold text-[var(--ink)]">Finance Actions</h3>
            <div className="mt-3 border-t border-[var(--line)] pt-3">
              <div className="space-y-2.5">
              <label className="block space-y-1 text-xs">
                <span className="font-semibold text-[var(--muted)]">Finance notes</span>
                <textarea
                  rows={2}
                  value={financeNotes}
                  onChange={(event) => setFinanceNotes(event.target.value)}
                  className="institutional-input w-full rounded-md px-3 py-2 text-sm outline-none"
                  placeholder="Optional notes for the finance record"
                />
              </label>
              {showFinancePendingPayment ? (
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold text-[var(--muted)]">Confirmed payment amount</span>
                  <input
                    value={approvedAmount}
                    onChange={(event) => setApprovedAmount(event.target.value)}
                    className="institutional-input w-full rounded-md px-3 py-2 text-sm outline-none"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Confirmed approved amount"
                  />
                </label>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {showFinanceStartProcessing ? (
                  <button
                    type="button"
                    disabled={isActionSubmitting}
                    onClick={(event) => openActionPrompt("finance-start-processing", event.currentTarget)}
                    className="primary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isActionSubmitting && pendingAction === "finance-start-processing" ? "Processing..." : "Start Processing"}
                  </button>
                ) : null}
                {showFinanceRaiseQuery ? (
                  <button
                    type="button"
                    disabled={isActionSubmitting}
                    onClick={(event) => openActionPrompt("finance-raise-query", event.currentTarget)}
                    className="secondary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isActionSubmitting && pendingAction === "finance-raise-query" ? "Processing..." : "Raise Query"}
                  </button>
                ) : null}
                {showFinancePendingPayment ? (
                  <button
                    type="button"
                    disabled={isActionSubmitting}
                    onClick={(event) => openActionPrompt("finance-pending-payment", event.currentTarget)}
                    className="primary-button rounded-sm px-3 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                  >
                    {isActionSubmitting && pendingAction === "finance-pending-payment" ? "Processing..." : "Schedule Payment"}
                  </button>
                ) : null}
              </div>
            </div>
            </div>
          </section>
        ) : null}

        {showCancel || showRestore || showReverse ? (
          <DetailSectionCard title="Request Controls">
            <div className="space-y-2">
              <textarea
                rows={2}
                value={adminComment}
                onChange={(event) => setAdminComment(event.target.value)}
                className="institutional-input w-full rounded-md px-3 py-2 text-sm outline-none"
                placeholder="Optional comment for the audit trail"
              />
              <div className="flex flex-wrap gap-2">
                {showCancel ? (
                  <button
                    type="button"
                    disabled={isActionSubmitting}
                    onClick={(event) => openActionPrompt("cancel", event.currentTarget)}
                    className="danger-button rounded-sm px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : null}
                {showRestore ? (
                  <button
                    type="button"
                    disabled={isActionSubmitting}
                    onClick={(event) => openActionPrompt("restore", event.currentTarget)}
                    className="secondary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Restore
                  </button>
                ) : null}
                {showReverse ? (
                  <button
                    type="button"
                    disabled={isActionSubmitting}
                    onClick={(event) => openActionPrompt("reverse", event.currentTarget)}
                    className="primary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Revert Decision
                  </button>
                ) : null}
              </div>
            </div>
          </DetailSectionCard>
        ) : null}

        <DetailSectionCard title="Payment Tracking">
          <div className="grid gap-2">
            <Field label="Amount Approved" value={formatCurrency(requestRecord.approved_amount)} />
            <Field label="Amount Disbursed" value={formatCurrency(requestRecord.disbursed_amount)} />
            <Field label="Payment Date" value={formatDate(requestRecord.payment_date)} />
            <Field label="Reference Number" value={requestRecord.payment_reference || "N/A"} />
            <Field label="Reviewed At" value={formatDateTime(requestRecord.reviewed_at)} />
            {canRecordPayment ? (
              <>
                <label className="grid gap-1 text-xs">
                  <span className="font-medium text-[var(--muted)]">Payment method</span>
                  <input value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="institutional-input rounded-md px-3 py-2 text-sm outline-none" />
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="font-medium text-[var(--muted)]">Payment reference</span>
                  <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className="institutional-input rounded-md px-3 py-2 text-sm outline-none" />
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="font-medium text-[var(--muted)]">{showAddPayment ? "Additional payment amount" : "Disbursed amount"}</span>
                  {showRecordPayment ? (
                    <input
                      value={recordPaymentAmount}
                      onChange={(event) => setRecordPaymentAmount(event.target.value)}
                      className="institutional-input rounded-md px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount actually disbursed"
                    />
                  ) : null}
                  {showAddPayment ? (
                    <input
                      value={additionalPaymentAmount}
                      onChange={(event) => setAdditionalPaymentAmount(event.target.value)}
                      className="institutional-input rounded-md px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Incremental payment amount"
                    />
                  ) : null}
                  {showMarkCompleted ? (
                    <input
                      value={completionAmount}
                      onChange={(event) => setCompletionAmount(event.target.value)}
                      className="institutional-input rounded-md px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Final disbursed amount (optional)"
                    />
                  ) : null}
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {showRecordPayment ? (
                    <button
                      type="button"
                      onClick={(event) => openActionPrompt("record-payment", event.currentTarget)}
                      disabled={isActionSubmitting}
                      className="primary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isActionSubmitting && pendingAction === "record-payment" ? "Processing..." : "Record Payment"}
                    </button>
                  ) : null}
                  {showAddPayment ? (
                    <button
                      type="button"
                      onClick={(event) => openActionPrompt("add-payment", event.currentTarget)}
                      disabled={isActionSubmitting || !additionalPaymentAmount.trim()}
                      className="primary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isActionSubmitting && pendingAction === "add-payment" ? "Processing..." : "Add Payment"}
                    </button>
                  ) : null}
                  {showMarkCompleted ? (
                    <button
                      type="button"
                      onClick={(event) => openActionPrompt("mark-completed", event.currentTarget)}
                      disabled={isActionSubmitting}
                      className="secondary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isActionSubmitting && pendingAction === "mark-completed" ? "Processing..." : "Mark Completed"}
                    </button>
                  ) : null}
                </div>
                {!showRecordPayment && !showAddPayment && !showMarkCompleted ? (
                  <p className="rounded-md bg-[var(--surface-low)] px-4 py-3 text-sm text-[var(--muted)]">
                    Payment actions are not available in the current status.
                  </p>
                ) : null}
              </>
            ) : null}
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">Remaining Balance</span>
                <span className="font-semibold text-[var(--ink)]">{formatCurrency(remainingBalance)}</span>
              </div>
              <div className="h-3 rounded-full bg-[var(--surface-container)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dim) 100%)",
                    width: `${requestRecord.approved_amount ? Math.min(((requestRecord.disbursed_amount ?? 0) / requestRecord.approved_amount) * 100, 100) : 0}%`
                  }}
                />
              </div>
            </div>
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="Add Document">
          {canUploadDocuments && canUploadForStatus ? (
            <div className="space-y-2.5">
              <label className="block space-y-1 text-xs">
                <span className="font-medium text-[var(--muted)]">Document type</span>
                <input
                  value={uploadType}
                  onChange={(event) => setUploadType(event.target.value)}
                  className="institutional-input w-full rounded-md px-3 py-2 text-sm outline-none"
                  placeholder="e.g. Supporting Document"
                  disabled={isUploadSubmitting}
                  aria-label="Document type"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="font-medium text-[var(--muted)]">File</span>
                <input
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  type="file"
                  disabled={isUploadSubmitting}
                  className="w-full cursor-pointer rounded-md border border-dashed border-[var(--line)] bg-[var(--surface-low)] px-4 py-4 text-sm text-[var(--muted)] outline-none transition file:mr-3 file:rounded file:border-0 file:bg-[var(--surface-container)] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[var(--ink)] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Select file to upload"
                />
              </label>
              {uploadFile ? (
                <p className="text-xs text-[var(--muted)]">
                  Selected: <span className="font-semibold text-[var(--ink)]">{uploadFile.name}</span>
                </p>
              ) : null}
              <button
                type="button"
                disabled={isUploadSubmitting || !uploadFile}
                onClick={() => {
                  if (!uploadFile) return;
                  setIsUploadSubmitting(true);
                  void uploadRequestDocument(requestRecord.id, uploadFile, uploadType)
                    .then(() => loadRequest())
                    .then(() => {
                      toast.success("Document uploaded successfully.", "Document added");
                      setUploadFile(null);
                    })
                    .catch((reason) => toast.error(reason instanceof Error ? reason.message : "Upload failed"))
                    .finally(() => setIsUploadSubmitting(false));
                }}
                className="secondary-button w-full rounded-sm px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploadSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="spin inline-block h-3.5 w-3.5 rounded-full border-2 border-[var(--muted)] border-t-[var(--ink)]" />
                    Uploading…
                  </span>
                ) : "Upload document"}
              </button>
            </div>
          ) : (
            <p className="rounded-md bg-[var(--surface-low)] px-4 py-4 text-sm text-[var(--muted)]">
              Document upload is not available for this request status.
            </p>
          )}
        </DetailSectionCard>
      </div>

      <AttachmentPreviewPanel
        isOpen={Boolean(previewFile)}
        title={previewFile?.title ?? "Document Preview"}
        fileName={previewFile?.fileName}
        fileUrl={previewFile?.fileUrl ?? ""}
        onClose={() => setPreviewFile(null)}
      />

      <ContextActionPrompt
        open={Boolean(pendingAction)}
        anchor={pendingActionAnchor}
        title={pendingAction === "reverse" ? "Revert Decision?" : "Confirm Action"}
        message={
          pendingAction === "reverse"
            ? "This will return the record to the previous review stage and restore available decision options."
            : `${actionLabel}. Continue?`
        }
        isSubmitting={isActionSubmitting}
        onCancel={() => {
          setPendingAction(null);
          setPendingActionAnchor(null);
        }}
        onConfirm={() => {
          if (pendingAction) {
            void runAction(pendingAction);
          }
        }}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-[var(--surface-low)] px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <div className="mt-1 text-xs font-semibold text-[var(--ink)]">{value}</div>
    </div>
  );
}
