import type { HistoryTimelineEntry } from "./historyTimeline";
import { sentenceCase } from "./format";
import type {
  ApprovalInboxItem,
  EnterpriseApprovalInstance,
  EnterpriseAuditEntry,
  EnterprisePaymentRequestRecord,
  EnterpriseWorkflowAction,
  FinanceInvoiceRecord,
  ProcurementRequestRecord,
  PurchaseOrderRecord,
  Tone
} from "../types";

export const enterpriseActionLabels: Record<EnterpriseWorkflowAction, string> = {
  edit: "Edit Draft",
  submit: "Submit for Approval",
  approve: "Approve",
  reject: "Reject",
  revert: "Revert Decision",
  convert_to_purchase_order: "Convert to PO",
  issue: "Issue PO",
  record_goods_receipt: "Record Receipt",
  post: "Post Invoice",
  create_payment_request: "Create Payment Request",
  mark_paid: "Mark as Paid"
};

export function hasWorkflowAction(actions: EnterpriseWorkflowAction[], action: EnterpriseWorkflowAction) {
  return actions.includes(action);
}

export function mapEnterpriseAuditTimeline(entries: EnterpriseAuditEntry[]): HistoryTimelineEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    title: entry.title,
    actorName: entry.actor_name || "System",
    createdAt: entry.created_at,
    body: entry.body || undefined,
    statusText: entry.status_text || undefined,
    tone: entry.tone
  }));
}

export function formatEnterpriseActionLabel(action: EnterpriseWorkflowAction) {
  return enterpriseActionLabels[action] ?? sentenceCase(action);
}

export type WorkflowQueueKey = "review" | "processing" | "delivery" | "payment" | "closed";

export type WorkflowStageKey =
  | "draft"
  | "director_review"
  | "director_rejected"
  | "finance_review"
  | "finance_rejected"
  | "payment_approval"
  | "procurement_processing"
  | "po_issued"
  | "awaiting_delivery"
  | "partially_received"
  | "received"
  | "pending_payment"
  | "partially_paid"
  | "paid"
  | "closed"
  | "cancelled";

export type WorkflowStageDescriptor = {
  key: WorkflowStageKey;
  label: string;
  queue: WorkflowQueueKey;
  tone: Tone;
};

export type ApprovalPriority = {
  label: "Urgent" | "High" | "Standard";
  tone: Tone;
};

function stage(key: WorkflowStageKey, label: string, queue: WorkflowQueueKey, tone: Tone): WorkflowStageDescriptor {
  return { key, label, queue, tone };
}

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function includesAny(haystack: string, patterns: string[]) {
  return patterns.some((pattern) => haystack.includes(pattern));
}

function isFinanceReviewMarker(roleKey?: string | null, stepName?: string | null) {
  const marker = `${normalize(roleKey)} ${normalize(stepName)}`;
  return includesAny(marker, ["finance", "budget"]);
}

function isDirectorReviewMarker(roleKey?: string | null, stepName?: string | null) {
  const marker = `${normalize(roleKey)} ${normalize(stepName)}`;
  return includesAny(marker, ["director", "admin", "executive", "approval"]);
}

function lastRejectedRoleKey(instance?: EnterpriseApprovalInstance | null) {
  const reversedDecisions = [...(instance?.decisions ?? [])].reverse();
  return reversedDecisions.find((decision) => normalize(decision.status) === "rejected")?.role_key ?? "";
}

function ageInHours(value: string) {
  const createdAt = Date.parse(value);
  if (Number.isNaN(createdAt)) {
    return 0;
  }
  return Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60));
}

export function getApprovalItemTypeLabel(item: ApprovalInboxItem) {
  if (item.entity_type === "procurement_request") {
    return "Procurement";
  }
  if (item.entity_type === "finance_invoice") {
    return "Invoice";
  }
  return "Payment Request";
}

export function getApprovalPriority(item: ApprovalInboxItem): ApprovalPriority {
  const ageHoursValue = ageInHours(item.created_at);
  const amount = Number(item.amount || 0);

  if (amount >= 10_000_000 || ageHoursValue >= 72) {
    return { label: "Urgent", tone: "danger" };
  }
  if (amount >= 3_000_000 || ageHoursValue >= 24) {
    return { label: "High", tone: "warning" };
  }
  return { label: "Standard", tone: "accent" };
}

export function deriveApprovalInboxStage(item: ApprovalInboxItem): WorkflowStageDescriptor {
  if (item.entity_type === "procurement_request") {
    if (isFinanceReviewMarker(item.pending_role_key, item.pending_step_name)) {
      return stage("finance_review", "Finance Review", "review", "warning");
    }
    return stage("director_review", "Director Review", "review", "warning");
  }

  if (item.entity_type === "finance_invoice") {
    return stage("finance_review", "Finance Review", "review", "warning");
  }

  return stage("payment_approval", "Payment Approval", "payment", "accent");
}

export function deriveProcurementStage(
  request: ProcurementRequestRecord,
  purchaseOrder?: PurchaseOrderRecord | null,
  finance?: {
    invoice?: FinanceInvoiceRecord | null;
    payment?: EnterprisePaymentRequestRecord | null;
  }
): WorkflowStageDescriptor {
  const requestStatus = normalize(request.status);
  const orderStatus = normalize(purchaseOrder?.status);
  const invoiceStatus = normalize(finance?.invoice?.status);
  const paymentStatus = normalize(finance?.payment?.status);

  if (requestStatus === "cancelled" || orderStatus === "cancelled") {
    return stage("cancelled", "Cancelled", "closed", "danger");
  }

  if (paymentStatus === "paid" || includesAny(invoiceStatus, ["paid", "reconciled"]) || orderStatus === "closed") {
    return stage("closed", "Closed", "closed", "success");
  }

  if (
    includesAny(paymentStatus, ["submitted", "approved"])
    || includesAny(invoiceStatus, ["draft", "posted", "approved"])
  ) {
    return stage("pending_payment", "Pending Payment", "payment", "warning");
  }

  if (orderStatus === "received") {
    return stage("received", "Received", "delivery", "success");
  }

  if (orderStatus === "partially_received") {
    return stage("partially_received", "Partially Received", "delivery", "warning");
  }

  if (orderStatus === "issued") {
    return stage("awaiting_delivery", "Awaiting Delivery", "delivery", "accent");
  }

  if (orderStatus === "draft" || requestStatus === "converted") {
    return stage("procurement_processing", "Procurement Processing", "processing", "accent");
  }

  if (requestStatus === "approved") {
    return stage("procurement_processing", "Procurement Processing", "processing", "accent");
  }

  if (requestStatus === "rejected") {
    const rejectedRole = lastRejectedRoleKey(request.approval_instance);
    return isFinanceReviewMarker(rejectedRole)
      ? stage("finance_rejected", "Finance Rejected", "review", "danger")
      : stage("director_rejected", "Director Rejected", "review", "danger");
  }

  if (requestStatus === "submitted") {
    const pendingRole = request.approval_instance?.pending_role_key ?? "";
    const pendingStep = request.approval_instance?.pending_step_name ?? "";
    if (isFinanceReviewMarker(pendingRole, pendingStep)) {
      return stage("finance_review", "Finance Review", "review", "warning");
    }
    if (isDirectorReviewMarker(pendingRole, pendingStep) || !pendingRole) {
      return stage("director_review", "Director Review", "review", "warning");
    }
  }

  return stage("draft", "Draft", "review", "accent");
}

export function deriveFinanceStage(
  invoice: FinanceInvoiceRecord,
  payment?: EnterprisePaymentRequestRecord | null
): WorkflowStageDescriptor {
  const invoiceStatus = normalize(invoice.status);
  const paymentStatus = normalize(payment?.status);

  if (paymentStatus === "paid" || includesAny(invoiceStatus, ["paid", "reconciled"])) {
    return stage("closed", "Closed", "closed", "success");
  }

  if (paymentStatus === "rejected") {
    return stage("finance_rejected", "Finance Rejected", "review", "danger");
  }

  if (includesAny(paymentStatus, ["submitted", "approved"]) || invoiceStatus === "approved") {
    return stage("pending_payment", "Pending Payment", "payment", "warning");
  }

  if (invoiceStatus === "posted") {
    return stage("finance_review", "Finance Review", "review", "warning");
  }

  return stage("finance_review", "Finance Review", "review", "accent");
}

export function deriveInventoryStage(order: PurchaseOrderRecord): WorkflowStageDescriptor {
  const orderStatus = normalize(order.status);

  if (orderStatus === "cancelled") {
    return stage("cancelled", "Cancelled", "closed", "danger");
  }
  if (orderStatus === "closed") {
    return stage("closed", "Closed", "closed", "success");
  }
  if (orderStatus === "received") {
    return stage("received", "Received", "delivery", "success");
  }
  if (orderStatus === "partially_received") {
    return stage("partially_received", "Partially Received", "delivery", "warning");
  }
  return stage("awaiting_delivery", "Awaiting Delivery", "delivery", "accent");
}

export function buildEnterpriseExportFilename(scope: string) {
  const normalizedScope = scope
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const dateStamp = new Date().toISOString().slice(0, 10);
  return `enterprise-${normalizedScope}-${dateStamp}.csv`;
}

export function downloadCsvFile(filename: string, header: string[], rows: Array<Array<string | number | null | undefined>>) {
  const csv = [header, ...rows]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
