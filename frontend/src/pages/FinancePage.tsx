import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { DetailSectionCard } from "../components/DetailSectionCard";
import { EnterpriseAttachmentPanel } from "../components/EnterpriseAttachmentPanel";
import { EnterpriseTimeline } from "../components/EnterpriseTimeline";
import { InlineBanner, StatePanel } from "../components/FeedbackStates";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { WorkflowActionBar } from "../components/WorkflowActionBar";
import { WorkspaceTabs } from "../components/WorkspaceTabs";
import { useSession } from "../context/SessionContext";
import { useToast } from "../context/ToastContext";
import {
  addFinanceInvoiceApprovalComment,
  addFinancePaymentApprovalComment,
  approveFinanceInvoice,
  approveFinancePaymentRequest,
  createFinancePaymentRequest,
  fetchFinanceWorkspace,
  markFinancePaymentPaid,
  postFinanceInvoice,
  rejectFinancePaymentRequest,
  revertFinanceInvoice,
  revertFinancePaymentRequest,
  uploadFinanceInvoiceAttachment,
  uploadFinancePaymentRequestAttachment
} from "../lib/api";
import { buildEnterpriseExportFilename, downloadCsvFile } from "../lib/enterpriseWorkflow";
import { formatCurrency, formatDate, formatDateTime } from "../lib/format";
import type {
  EnterprisePaymentRequestRecord,
  EnterpriseWorkflowAction,
  FinanceInvoiceRecord,
  FinanceWorkspace,
  Stat
} from "../types";

type InspectorFocus = "invoice" | "payment_request";
type InspectorTab = "workbench" | "attachments" | "timeline";

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unable to complete the finance action";
}

export function FinancePage() {
  const { hasAnyPermission } = useSession();
  const toast = useToast();

  const [workspace, setWorkspace] = useState<FinanceWorkspace | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [inspectorFocus, setInspectorFocus] = useState<InspectorFocus>("invoice");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("workbench");

  const [postAmount, setPostAmount] = useState("");
  const [postInvoiceDate, setPostInvoiceDate] = useState("");
  const [paymentRequestAmount, setPaymentRequestAmount] = useState("");
  const [markPaidReference, setMarkPaidReference] = useState("");
  const [approvalComment, setApprovalComment] = useState("");

  const [actingAction, setActingAction] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = async (options?: { focusInvoiceId?: string | null; focusPaymentId?: string | null }) => {
    setIsLoading(true);
    try {
      const payload = await fetchFinanceWorkspace();
      const focusInvoiceId = options?.focusInvoiceId ?? selectedInvoiceId ?? payload.invoices[0]?.id ?? null;
      const focusPaymentId = options?.focusPaymentId ?? selectedPaymentId ?? null;
      setWorkspace(payload);
      setSelectedInvoiceId(focusInvoiceId);
      setSelectedPaymentId(focusPaymentId);
      setError(null);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const selectedInvoice = selectedInvoiceId
    ? workspace?.invoices.find((item) => item.id === selectedInvoiceId) ?? null
    : workspace?.invoices[0] ?? null;

  const selectedPayment = selectedPaymentId
    ? workspace?.payment_requests.find((item) => item.id === selectedPaymentId) ?? null
    : null;

  const currencyCode = workspace?.organization?.currency_code ?? "TZS";

  const canUploadInvoiceAttachments = hasAnyPermission(["invoice:post", "invoice:approve"]);
  const canUploadPaymentAttachments = hasAnyPermission(["payment_request:approve", "payment:record"]);

  const stats: Stat[] = [
    { label: "Draft Invoices", value: String(workspace?.summary.draft_invoices ?? 0), change: "Awaiting posting", tone: "accent" },
    { label: "Posted", value: String(workspace?.summary.posted_invoices ?? 0), change: "Pending finance approval", tone: "warning" },
    { label: "Approved", value: String(workspace?.summary.approved_invoices ?? 0), change: "Ready for payment", tone: "accent" },
    { label: "Pending Payments", value: String(workspace?.summary.pending_payments ?? 0), change: "Awaiting disbursement", tone: "danger" },
    { label: "Paid", value: String(workspace?.summary.paid_requests ?? 0), change: "Completed transactions", tone: "success" },
    { label: "Budget Risk", value: String(workspace?.summary.budget_risk_accounts ?? 0), change: "Accounts over threshold", tone: "danger" }
  ];

  const handleInvoiceAction = async (action: EnterpriseWorkflowAction) => {
    if (!selectedInvoice) return;
    setActingAction(action);
    try {
      if (action === "post") {
        const payload: { amount?: number; invoice_date?: string } = {};
        if (postAmount.trim()) payload.amount = Number(postAmount);
        if (postInvoiceDate.trim()) payload.invoice_date = postInvoiceDate;
        const response = await postFinanceInvoice(selectedInvoice.id, payload);
        toast.success(response.message ?? `${selectedInvoice.invoice_number} posted.`);
        setPostAmount("");
        setPostInvoiceDate("");
      } else if (action === "approve") {
        const response = await approveFinanceInvoice(selectedInvoice.id);
        toast.success(response.message ?? `${selectedInvoice.invoice_number} approved.`);
      } else if (action === "revert") {
        const response = await revertFinanceInvoice(selectedInvoice.id, approvalComment.trim());
        toast.success(response.message ?? `${selectedInvoice.invoice_number} reverted.`);
        setApprovalComment("");
      } else if (action === "create_payment_request") {
        const payload: { amount?: number } = {};
        if (paymentRequestAmount.trim()) payload.amount = Number(paymentRequestAmount);
        const response = await createFinancePaymentRequest(selectedInvoice.id, payload);
        toast.success(response.message ?? "Payment request created.");
        setPaymentRequestAmount("");
        await loadWorkspace({ focusInvoiceId: selectedInvoice.id, focusPaymentId: response.payment_request.id });
        setSelectedPaymentId(response.payment_request.id);
        setInspectorFocus("payment_request");
        return;
      }
      await loadWorkspace({ focusInvoiceId: selectedInvoice.id });
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setActingAction(null);
    }
  };

  const handleInvoiceComment = async () => {
    if (!selectedInvoice || !approvalComment.trim()) {
      toast.warning("Add a note before saving it to the approval history.");
      return;
    }
    setActingAction("comment");
    try {
      const response = await addFinanceInvoiceApprovalComment(selectedInvoice.id, approvalComment.trim());
      toast.success(response.message ?? "Note saved.");
      setApprovalComment("");
      await loadWorkspace({ focusInvoiceId: selectedInvoice.id });
      setInspectorTab("timeline");
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setActingAction(null);
    }
  };

  const handlePaymentAction = async (action: EnterpriseWorkflowAction) => {
    if (!selectedPayment) return;
    setActingAction(action);
    try {
      if (action === "approve") {
        const response = await approveFinancePaymentRequest(selectedPayment.id);
        toast.success(response.message ?? `${selectedPayment.payment_request_number} approved.`);
      } else if (action === "reject") {
        if (!approvalComment.trim()) {
          toast.warning("Add a rejection reason before rejecting this payment request.");
          setActingAction(null);
          return;
        }
        const response = await rejectFinancePaymentRequest(selectedPayment.id, approvalComment.trim());
        toast.success(response.message ?? `${selectedPayment.payment_request_number} rejected.`);
        setApprovalComment("");
      } else if (action === "revert") {
        const response = await revertFinancePaymentRequest(selectedPayment.id, approvalComment.trim());
        toast.success(response.message ?? `${selectedPayment.payment_request_number} reverted.`);
        setApprovalComment("");
      } else if (action === "mark_paid") {
        if (!markPaidReference.trim()) {
          toast.warning("Enter a payment reference before marking this request as paid.");
          setActingAction(null);
          return;
        }
        const response = await markFinancePaymentPaid(selectedPayment.id, markPaidReference.trim());
        toast.success(response.message ?? `${selectedPayment.payment_request_number} marked as paid.`);
        setMarkPaidReference("");
      }
      await loadWorkspace({ focusInvoiceId: selectedInvoiceId, focusPaymentId: selectedPayment.id });
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setActingAction(null);
    }
  };

  const handlePaymentComment = async () => {
    if (!selectedPayment || !approvalComment.trim()) {
      toast.warning("Add a note before saving it to the approval history.");
      return;
    }
    setActingAction("comment");
    try {
      const response = await addFinancePaymentApprovalComment(selectedPayment.id, approvalComment.trim());
      toast.success(response.message ?? "Note saved.");
      setApprovalComment("");
      await loadWorkspace({ focusInvoiceId: selectedInvoiceId, focusPaymentId: selectedPayment.id });
      setInspectorTab("timeline");
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setActingAction(null);
    }
  };

  const handleInvoiceAttachmentUpload = async (file: File, attachmentType: string) => {
    if (!selectedInvoice) return;
    setIsUploadingAttachment(true);
    try {
      const response = await uploadFinanceInvoiceAttachment(selectedInvoice.id, file, attachmentType);
      toast.success(response.message ?? "Attachment uploaded.");
      await loadWorkspace({ focusInvoiceId: response.invoice.id });
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handlePaymentAttachmentUpload = async (file: File, attachmentType: string) => {
    if (!selectedPayment) return;
    setIsUploadingAttachment(true);
    try {
      const response = await uploadFinancePaymentRequestAttachment(selectedPayment.id, file, attachmentType);
      toast.success(response.message ?? "Attachment uploaded.");
      await loadWorkspace({ focusInvoiceId: selectedInvoiceId, focusPaymentId: response.payment_request.id });
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  if (isLoading || !workspace) {
    return <StatePanel variant="loading" title="Loading finance" message="Loading invoices and payment requests." />;
  }

  if (error) {
    return <StatePanel variant="error" title="Finance unavailable" message={error} actionLabel="Retry" onAction={() => void loadWorkspace()} />;
  }

  const inspectorEntity = inspectorFocus === "payment_request" ? selectedPayment : selectedInvoice;
  const inspectorTimeline = inspectorFocus === "payment_request"
    ? selectedPayment?.audit_timeline ?? []
    : selectedInvoice?.audit_timeline ?? [];
  const inspectorAttachments = inspectorFocus === "payment_request"
    ? selectedPayment?.attachments ?? []
    : selectedInvoice?.attachments ?? [];
  const canUploadAttachments = inspectorFocus === "payment_request" ? canUploadPaymentAttachments : canUploadInvoiceAttachments;
  const onUploadAttachment = inspectorFocus === "payment_request" ? handlePaymentAttachmentUpload : handleInvoiceAttachmentUpload;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {stats.map((stat, index) => (
            <div key={stat.label} className={`item-enter item-enter-${index + 1}`}>
              <StatCard {...stat} />
            </div>
          ))}
        </div>

        <InlineBanner
          variant="info"
          title="Workflow"
          message="Approved invoices move to payment requests."
        />

        <SectionCard
          testId="finance-invoices-section"
          title="Invoices"
          subtitle="Draft, posted, and approved invoices."
          action={
            <button
              type="button"
              onClick={() =>
                downloadCsvFile(
                  buildEnterpriseExportFilename("finance-invoices"),
                  ["Invoice", "Vendor", "Amount", "Date", "Status", "Payment Request"],
                  workspace.invoices.map((item) => [
                    item.invoice_number,
                    item.vendor_name ?? "",
                    item.amount,
                    item.invoice_date,
                    item.status_display,
                    item.payment_request_number ?? ""
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
          <DataTable
            columns={[
              { key: "invoice_number", label: "Invoice", render: (row) => <span className="font-semibold">{row.invoice_number}</span> },
              { key: "vendor_name", label: "Vendor" },
              { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount, currencyCode) },
              { key: "invoice_date", label: "Date", render: (row) => formatDate(row.invoice_date) },
              { key: "status_display", label: "Status", render: (row) => <StatusBadge status={row.status_display} /> },
              {
                key: "actions",
                label: "Focus",
                render: (row) => (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedInvoiceId(row.id);
                      setInspectorFocus("invoice");
                    }}
                    aria-label={`Inspect invoice ${row.invoice_number}`}
                    className="primary-button rounded-sm px-3 py-1.5 text-xs font-semibold"
                  >
                    Inspect
                  </button>
                )
              }
            ]}
            rows={workspace.invoices}
            emptyMessage="No finance invoices have been generated yet."
          />
        </SectionCard>

        <SectionCard
          testId="finance-payment-requests-section"
          title="Payment Requests"
          subtitle="Approved invoices awaiting payment."
          action={
            <button
              type="button"
              onClick={() =>
                downloadCsvFile(
                  buildEnterpriseExportFilename("payment-requests"),
                  ["Request", "Invoice", "Amount", "Status", "Requested By", "Paid At"],
                  workspace.payment_requests.map((item) => [
                    item.payment_request_number,
                    item.invoice_number ?? "",
                    item.amount,
                    item.status_display,
                    item.requested_by_name ?? "",
                    item.paid_at ?? ""
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
          <DataTable
            columns={[
              { key: "payment_request_number", label: "Request", render: (row) => <span className="font-semibold">{row.payment_request_number}</span> },
              { key: "invoice_number", label: "Invoice" },
              { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount, currencyCode) },
              { key: "status_display", label: "Status", render: (row) => <StatusBadge status={row.status_display} /> },
              { key: "requested_by_name", label: "Requested By" },
              {
                key: "actions",
                label: "Focus",
                render: (row) => (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentId(row.id);
                      setInspectorFocus("payment_request");
                    }}
                    aria-label={`Inspect payment request ${row.payment_request_number}`}
                    className="secondary-button rounded-sm px-3 py-1.5 text-xs font-semibold"
                  >
                    Inspect
                  </button>
                )
              }
            ]}
            rows={workspace.payment_requests}
            emptyMessage="No payment requests have been raised yet."
          />
        </SectionCard>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-[5.25rem] xl:max-h-[calc(100vh-6.75rem)] xl:overflow-y-auto">
        <DetailSectionCard
          testId="finance-inspector"
          title={inspectorFocus === "payment_request" ? "Payment Request" : "Invoice"}
          subtitle={inspectorEntity
            ? inspectorFocus === "payment_request"
              ? (selectedPayment?.payment_request_number ?? "")
              : (selectedInvoice?.invoice_number ?? "")
            : "No record selected"}
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInspectorFocus("invoice")}
                className={`rounded-sm px-3 py-1.5 text-xs font-semibold ${inspectorFocus === "invoice" ? "primary-button" : "secondary-button"}`}
              >
                Invoice
              </button>
              <button
                type="button"
                onClick={() => setInspectorFocus("payment_request")}
                className={`rounded-sm px-3 py-1.5 text-xs font-semibold ${inspectorFocus === "payment_request" ? "primary-button" : "secondary-button"}`}
              >
                Payment Request
              </button>
            </div>

            <WorkspaceTabs
              tabs={[
                { key: "workbench", label: "Workbench" },
                { key: "attachments", label: "Attachments" },
                { key: "timeline", label: "Timeline" }
              ]}
              activeTab={inspectorTab}
              onChange={(tab) => setInspectorTab(tab as InspectorTab)}
            />

            {inspectorTab === "workbench" ? (
              inspectorFocus === "invoice" ? (
                <InvoiceWorkbench
                  invoice={selectedInvoice}
                  currencyCode={currencyCode}
                  postAmount={postAmount}
                  postInvoiceDate={postInvoiceDate}
                  paymentRequestAmount={paymentRequestAmount}
                  approvalComment={approvalComment}
                  actingAction={actingAction}
                  setPostAmount={setPostAmount}
                  setPostInvoiceDate={setPostInvoiceDate}
                  setPaymentRequestAmount={setPaymentRequestAmount}
                  setApprovalComment={setApprovalComment}
                  onAction={handleInvoiceAction}
                  onAddComment={handleInvoiceComment}
                />
              ) : (
                <PaymentRequestWorkbench
                  payment={selectedPayment}
                  currencyCode={currencyCode}
                  markPaidReference={markPaidReference}
                  approvalComment={approvalComment}
                  actingAction={actingAction}
                  setMarkPaidReference={setMarkPaidReference}
                  setApprovalComment={setApprovalComment}
                  onAction={handlePaymentAction}
                  onAddComment={handlePaymentComment}
                />
              )
            ) : null}

            {inspectorTab === "attachments" ? (
              inspectorEntity ? (
                <EnterpriseAttachmentPanel
                  attachments={inspectorAttachments}
                  canUpload={canUploadAttachments}
                  isUploading={isUploadingAttachment}
                  uploadLabel={inspectorFocus === "payment_request" ? "Upload Payment Attachment" : "Upload Invoice Attachment"}
                  emptyMessage="No attachments have been uploaded for this record."
                  onUpload={onUploadAttachment}
                />
              ) : (
                <p className="text-sm text-[var(--muted)]">Select an invoice or payment request to manage attachments.</p>
              )
            ) : null}

            {inspectorTab === "timeline" ? (
              <EnterpriseTimeline entries={inspectorTimeline} emptyMessage="No events recorded for this record yet." />
            ) : null}
          </div>
        </DetailSectionCard>
      </aside>
    </div>
  );
}

function InvoiceWorkbench({
  invoice,
  currencyCode,
  postAmount,
  postInvoiceDate,
  paymentRequestAmount,
  approvalComment,
  actingAction,
  setPostAmount,
  setPostInvoiceDate,
  setPaymentRequestAmount,
  setApprovalComment,
  onAction,
  onAddComment
}: {
  invoice: FinanceInvoiceRecord | null;
  currencyCode: string;
  postAmount: string;
  postInvoiceDate: string;
  paymentRequestAmount: string;
  approvalComment: string;
  actingAction: string | null;
  setPostAmount: (value: string) => void;
  setPostInvoiceDate: (value: string) => void;
  setPaymentRequestAmount: (value: string) => void;
  setApprovalComment: (value: string) => void;
  onAction: (action: EnterpriseWorkflowAction) => Promise<void>;
  onAddComment: () => Promise<void>;
}) {
  if (!invoice) {
    return <StatePanel variant="empty" title="No invoice selected" message="Select an invoice from the table to review and act on it." compact />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-2">
        <InfoCard label="Vendor" value={invoice.vendor_name ?? "Unknown"} />
        <InfoCard label="Amount" value={formatCurrency(invoice.amount, currencyCode)} />
        <InfoCard label="Date" value={formatDate(invoice.invoice_date)} />
        <InfoCard label="Status" value={invoice.status_display} />
        {invoice.department_name ? <InfoCard label="Department" value={invoice.department_name} /> : null}
        {invoice.branch_name ? <InfoCard label="Branch" value={invoice.branch_name} /> : null}
      </div>

      {invoice.available_actions.includes("post") ? (
        <div className="space-y-3 rounded-lg border border-[var(--line)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Post Invoice</p>
          <input
            type="number"
            step="0.01"
            value={postAmount}
            onChange={(event) => setPostAmount(event.target.value)}
            placeholder={`Amount (default: ${formatCurrency(invoice.amount, currencyCode)})`}
            aria-label="Invoice amount override"
            className="institutional-input w-full rounded-xl px-4 py-3 outline-none"
          />
          <input
            type="date"
            value={postInvoiceDate}
            onChange={(event) => setPostInvoiceDate(event.target.value)}
            aria-label="Invoice date"
            className="institutional-input w-full rounded-xl px-4 py-3 outline-none"
          />
        </div>
      ) : null}

      {invoice.available_actions.includes("create_payment_request") ? (
        <div className="space-y-3 rounded-lg border border-[var(--line)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Payment Request Amount</p>
          <input
            type="number"
            step="0.01"
            value={paymentRequestAmount}
            onChange={(event) => setPaymentRequestAmount(event.target.value)}
            placeholder={`Default: ${formatCurrency(invoice.amount, currencyCode)}`}
            aria-label="Payment request amount"
            className="institutional-input w-full rounded-xl px-4 py-3 outline-none"
          />
        </div>
      ) : null}

      <WorkflowActionBar
        actions={invoice.available_actions}
        busyAction={actingAction && actingAction !== "comment" ? (actingAction as EnterpriseWorkflowAction) : null}
        testIdPrefix="finance-invoice-action"
        onAction={(action) => void onAction(action)}
        emptyMessage="No invoice actions are available in the current state."
      />

      {invoice.payment_request_number ? (
        <div className="rounded-lg border border-[var(--line)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Linked Payment Request</p>
          <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{invoice.payment_request_number}</p>
          {invoice.payment_request_status ? <StatusBadge status={invoice.payment_request_status} /> : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Decision Note</label>
        <textarea
          value={approvalComment}
          onChange={(event) => setApprovalComment(event.target.value)}
          rows={2}
          placeholder="Add an approval note, correction request, or rejection reason."
          className="institutional-input w-full rounded-xl px-4 py-3 outline-none"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void onAddComment()}
            disabled={actingAction === "comment" || !approvalComment.trim()}
            className="secondary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {actingAction === "comment" ? "Saving..." : "Save Note"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentRequestWorkbench({
  payment,
  currencyCode,
  markPaidReference,
  approvalComment,
  actingAction,
  setMarkPaidReference,
  setApprovalComment,
  onAction,
  onAddComment
}: {
  payment: EnterprisePaymentRequestRecord | null;
  currencyCode: string;
  markPaidReference: string;
  approvalComment: string;
  actingAction: string | null;
  setMarkPaidReference: (value: string) => void;
  setApprovalComment: (value: string) => void;
  onAction: (action: EnterpriseWorkflowAction) => Promise<void>;
  onAddComment: () => Promise<void>;
}) {
  if (!payment) {
    return <StatePanel variant="empty" title="No payment request selected" message="Select a payment request from the table to review and act on it." compact />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-2">
        <InfoCard label="Request No." value={payment.payment_request_number} />
        <InfoCard label="Amount" value={formatCurrency(payment.amount, currencyCode)} />
        <InfoCard label="Status" value={payment.status_display} />
        <InfoCard label="Requested By" value={payment.requested_by_name ?? "Unknown"} />
        {payment.department_name ? <InfoCard label="Department" value={payment.department_name} /> : null}
        {payment.branch_name ? <InfoCard label="Branch" value={payment.branch_name} /> : null}
      </div>

      {payment.available_actions.includes("mark_paid") ? (
        <div className="space-y-3 rounded-lg border border-[var(--line)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Payment Reference</p>
          <input
            value={markPaidReference}
            onChange={(event) => setMarkPaidReference(event.target.value)}
            placeholder="Bank transfer reference, cheque number, etc."
            aria-label="Payment reference"
            className="institutional-input w-full rounded-xl px-4 py-3 outline-none"
          />
        </div>
      ) : null}

      <WorkflowActionBar
        actions={payment.available_actions}
        busyAction={actingAction && actingAction !== "comment" ? (actingAction as EnterpriseWorkflowAction) : null}
        testIdPrefix="finance-payment-action"
        onAction={(action) => void onAction(action)}
        emptyMessage="No payment actions are available in the current state."
      />

      {payment.paid_at ? (
        <div className="rounded-lg border border-[var(--line)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Payment Record</p>
          <p className="mt-2 text-xs text-[var(--muted)]">Paid {formatDateTime(payment.paid_at)}</p>
          {payment.payment_reference ? (
            <p className="mt-1 text-sm font-semibold text-[var(--ink)]">Ref: {payment.payment_reference}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Decision Note</label>
        <textarea
          value={approvalComment}
          onChange={(event) => setApprovalComment(event.target.value)}
          rows={2}
          placeholder="Add an approval note or rejection reason."
          className="institutional-input w-full rounded-xl px-4 py-3 outline-none"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void onAddComment()}
            disabled={actingAction === "comment" || !approvalComment.trim()}
            className="secondary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {actingAction === "comment" ? "Saving..." : "Save Note"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}
