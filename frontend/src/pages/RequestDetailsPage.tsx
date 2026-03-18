import { Download, FileText } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { AttachmentPreviewPanel } from "../components/AttachmentPreviewPanel";
import { DetailSectionCard } from "../components/DetailSectionCard";
import { RecordChatter } from "../components/RecordChatter";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { useSession } from "../context/SessionContext";
import { useToast } from "../context/ToastContext";
import {
  addRequestTimelineEntry,
  addRequestPayment,
  approveRequest,
  cancelRequest,
  completeRequestPayment,
  fetchRequest,
  markRequestPaid,
  rejectRequest,
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
  | "record-payment"
  | "add-payment"
  | "mark-completed"
  | "cancel"
  | "restore"
  | "reverse";

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
  const [previewFile, setPreviewFile] = useState<{ title: string; fileName?: string; fileUrl: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<RequestWorkflowAction | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [isTimelineSubmitting, setIsTimelineSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRequest = async () => {
    if (!requestId) {
      return;
    }
    try {
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
    }
  };

  useEffect(() => {
    void loadRequest();
  }, [requestId]);

  if (loadError) {
    return <SectionCard title="Request Details">{loadError}</SectionCard>;
  }

  if (!requestRecord) {
    return <SectionCard title="Request Details">Loading request record...</SectionCard>;
  }

  const isDirector = hasRole("director");
  const canApprove = isDirector && hasPermission("request:approve");
  const canReject = isDirector && hasPermission("request:reject");
  const canStartReview = hasPermission("request:update_all") || hasPermission("request:update_own");
  const canDecide = canApprove || canReject;
  const canRecordPayment = hasPermission("payment:record");
  const canUploadDocuments = hasPermission("request:upload_all") || hasPermission("request:upload_own");
  const canCancel = hasPermission("request:cancel");
  const canRestore = hasPermission("request:restore");
  const canReverse = hasPermission("request:reverse");
  const visibility = getRequestActionVisibility(requestRecord.status);
  const showStartReview = canStartReview && visibility.showStartReview;
  const showApprove = canApprove && visibility.showApprove;
  const showReject = canReject && visibility.showReject;
  const showRecordPayment = canRecordPayment && visibility.showRecordPayment;
  const showAddPayment = canRecordPayment && visibility.showAddPayment;
  const showMarkCompleted = canRecordPayment && visibility.showMarkCompleted;
  const showCancel = canCancel && visibility.showCancel;
  const showRestore = canRestore && visibility.showRestore;
  const showReverse = canReverse && visibility.showReverse;
  const canUploadForStatus = !["cancelled", "archived"].includes(requestRecord.status);
  const remainingBalance = (requestRecord.approved_amount ?? 0) - (requestRecord.disbursed_amount ?? 0);
  const canComposeTimeline = hasRole("director") || hasRole("admin");

  const actionSuccessMessages: Record<RequestWorkflowAction, { title: string; message: string }> = {
    "start-review": { title: "Request updated", message: "Request moved to under review." },
    approve: { title: "Request approved", message: "Request approved successfully." },
    reject: { title: "Request rejected", message: "Request rejected successfully." },
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
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to update request workflow");
    } finally {
      setIsActionSubmitting(false);
    }
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
    if (pendingAction === "record-payment") return "Record Payment";
    if (pendingAction === "add-payment") return "Add Payment";
    if (pendingAction === "mark-completed") return "Mark Completed";
    if (pendingAction === "cancel") return "Cancel Request";
    if (pendingAction === "restore") return "Restore Request";
    return "Revert Decision";
  })();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <DetailSectionCard title="Applicant Information">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name" value={requestRecord.applicant_name} />
            <Field label="Phone" value={requestRecord.applicant_phone} />
            <Field label="Email" value={requestRecord.applicant_email} />
            <Field label="Organization" value={requestRecord.applicant_organization || "N/A"} />
            <Field label="Role" value={requestRecord.applicant_role || "N/A"} />
            <Field label="Region" value={requestRecord.applicant_region || "N/A"} />
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="Request Information">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Request ID" value={requestRecord.request_id} />
            <Field label="Category" value={requestRecord.category_display} />
            <Field label="Current Status" value={<StatusBadge status={requestRecord.status_display} />} />
            <Field label="Amount Requested" value={formatCurrency(requestRecord.amount_requested)} />
            <Field label="Beneficiaries" value={requestRecord.number_of_beneficiaries ?? "N/A"} />
            <Field label="Location" value={requestRecord.address} />
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{requestRecord.title || "Untitled request"}</p>
            <p className="mt-2">{requestRecord.description}</p>
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="Attachments">
          <div className="space-y-3">
            {requestRecord.documents.length ? (
              requestRecord.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{doc.document_type}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(doc.uploaded_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewFile({ title: doc.document_type, fileName: doc.filename, fileUrl: doc.download_url ?? doc.document })}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
                    >
                      Preview
                    </button>
                    <a
                      href={doc.download_url ?? doc.document}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-cyan-500 dark:text-slate-900"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No request documents uploaded yet.</p>
            )}
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="Record Timeline" subtitle="Comments, approvals, status changes, and workflow notes.">
          <RecordChatter
            title="Record History"
            subtitle="Permanent comments and workflow events for this request."
            entries={requestRecord.timeline_entries ?? []}
            emptyMessage="No request history is available yet."
            canAddComment={canComposeTimeline}
            canAddInternalNote={canComposeTimeline}
            isSubmitting={isTimelineSubmitting}
            onSubmit={submitTimelineEntry}
          />
        </DetailSectionCard>
      </div>

      <div className="space-y-6">
        <DetailSectionCard title="Decision Section">
          {canDecide || showStartReview ? (
            <div className="space-y-4">
              {showStartReview ? (
                <button
                  type="button"
                  disabled={isActionSubmitting}
                  onClick={() => setPendingAction("start-review")}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold disabled:opacity-60 dark:border-white/10"
                >
                  {isActionSubmitting && pendingAction === "start-review" ? "Processing..." : "Move To Under Review"}
                </button>
              ) : null}
              <input
                value={approvedAmount}
                onChange={(event) => setApprovedAmount(event.target.value)}
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                placeholder="Approved amount"
                type="number"
                min="0"
                step="0.01"
              />
              <textarea
                rows={5}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                placeholder="Decision comments"
              />
              {showApprove || showReject ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {showApprove ? (
                    <button
                      type="button"
                      disabled={isActionSubmitting}
                      onClick={() => setPendingAction("approve")}
                      className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isActionSubmitting && pendingAction === "approve" ? "Processing..." : "Approve Request"}
                    </button>
                  ) : null}
                  {showReject ? (
                    <button
                      type="button"
                      disabled={isActionSubmitting}
                      onClick={() => setPendingAction("reject")}
                      className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isActionSubmitting && pendingAction === "reject" ? "Processing..." : "Reject Request"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  Decision actions are not available in the current status.
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Only the Director can approve or reject requests.
            </p>
          )}
        </DetailSectionCard>

        {showCancel || showRestore || showReverse ? (
          <DetailSectionCard title="Request Controls">
            <div className="space-y-3">
              <textarea
                rows={3}
                value={adminComment}
                onChange={(event) => setAdminComment(event.target.value)}
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                placeholder="Optional comment for the audit trail"
              />
              <div className="grid gap-3 sm:grid-cols-3">
                {showCancel ? (
                  <button
                    type="button"
                    disabled={isActionSubmitting}
                    onClick={() => setPendingAction("cancel")}
                    className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Cancel
                  </button>
                ) : null}
                {showRestore ? (
                  <button
                    type="button"
                    disabled={isActionSubmitting}
                    onClick={() => setPendingAction("restore")}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold disabled:opacity-60 dark:border-white/10"
                  >
                    Restore
                  </button>
                ) : null}
                {showReverse ? (
                  <button
                    type="button"
                    disabled={isActionSubmitting}
                    onClick={() => setPendingAction("reverse")}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-blue-500"
                  >
                    Revert Decision
                  </button>
                ) : null}
              </div>
            </div>
          </DetailSectionCard>
        ) : null}

        <DetailSectionCard title="Payment Tracking">
          <div className="grid gap-4">
            <Field label="Amount Approved" value={formatCurrency(requestRecord.approved_amount)} />
            <Field label="Amount Disbursed" value={formatCurrency(requestRecord.disbursed_amount)} />
            <Field label="Payment Date" value={formatDate(requestRecord.payment_date)} />
            <Field label="Reference Number" value={requestRecord.payment_reference || "N/A"} />
            <Field label="Reviewed At" value={formatDateTime(requestRecord.reviewed_at)} />
            {canRecordPayment ? (
              <>
                <label className="grid gap-2 text-sm">
                  <span>Payment method</span>
                  <input value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Payment reference</span>
                  <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>{showAddPayment ? "Additional payment amount" : "Disbursed amount"}</span>
                  {showRecordPayment ? (
                    <input
                      value={recordPaymentAmount}
                      onChange={(event) => setRecordPaymentAmount(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
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
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
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
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
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
                      onClick={() => setPendingAction("record-payment")}
                      disabled={isActionSubmitting}
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-blue-500"
                    >
                      {isActionSubmitting && pendingAction === "record-payment" ? "Processing..." : "Record Payment"}
                    </button>
                  ) : null}
                  {showAddPayment ? (
                    <button
                      type="button"
                      onClick={() => setPendingAction("add-payment")}
                      disabled={isActionSubmitting || !additionalPaymentAmount.trim()}
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-blue-500"
                    >
                      {isActionSubmitting && pendingAction === "add-payment" ? "Processing..." : "Add Payment"}
                    </button>
                  ) : null}
                  {showMarkCompleted ? (
                    <button
                      type="button"
                      onClick={() => setPendingAction("mark-completed")}
                      disabled={isActionSubmitting}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold disabled:opacity-60 dark:border-white/10"
                    >
                      {isActionSubmitting && pendingAction === "mark-completed" ? "Processing..." : "Mark Completed"}
                    </button>
                  ) : null}
                </div>
                {!showRecordPayment && !showAddPayment && !showMarkCompleted ? (
                  <p className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    Payment actions are not available in the current status.
                  </p>
                ) : null}
              </>
            ) : null}
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Remaining Balance</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(remainingBalance)}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                  style={{
                    width: `${requestRecord.approved_amount ? Math.min(((requestRecord.disbursed_amount ?? 0) / requestRecord.approved_amount) * 100, 100) : 0}%`
                  }}
                />
              </div>
            </div>
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="Add Document">
          {canUploadDocuments && canUploadForStatus ? (
            <div className="space-y-3">
              <input
                value={uploadType}
                onChange={(event) => setUploadType(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
              />
              <input
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                type="file"
                className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 outline-none dark:border-white/10 dark:bg-white/5"
              />
              <button
                onClick={() =>
                  uploadFile &&
                  void uploadRequestDocument(requestRecord.id, uploadFile, uploadType)
                    .then(() => loadRequest())
                    .then(() => {
                      toast.success("Document uploaded successfully.", "Document added");
                      setUploadFile(null);
                    })
                    .catch((reason) => toast.error(reason instanceof Error ? reason.message : "Upload failed"))
                }
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-white/10"
              >
                Upload document
              </button>
            </div>
          ) : (
            <p className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
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

      {pendingAction ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {pendingAction === "reverse" ? "Revert Decision?" : "Confirm Action"}
            </h4>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {pendingAction === "reverse"
                ? "This will return the record to the previous review stage and restore available decision options."
                : `${actionLabel}. Continue?`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={isActionSubmitting}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runAction(pendingAction)}
                disabled={isActionSubmitting}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-900"
              >
                {isActionSubmitting ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
