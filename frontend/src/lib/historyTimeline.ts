import { sentenceCase } from "./format";
import type { InvitationHistoryRecord, RecordTimelineEntryRecord, RequestHistoryRecord } from "../types";

export type HistoryTimelineTone = "neutral" | "info" | "success" | "danger" | "warning";

export type HistoryTimelineEntry = {
  id: string;
  label: string;
  title: string;
  actorName: string;
  createdAt: string;
  body?: string;
  statusText?: string;
  tone: HistoryTimelineTone;
};

function prettifyStatus(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  return sentenceCase(value);
}

function requestActionLabel(action: string) {
  const actionMap: Record<string, string> = {
    created: "Request created",
    updated: "Request updated",
    submitted: "Submitted for review",
    moved_to_review: "Moved to under review",
    approved: "Request approved",
    rejected: "Request rejected",
    partially_paid: "Partial payment recorded",
    paid: "Payment completed",
    cancelled: "Request cancelled",
    restored: "Request restored",
    reversed: "Decision reverted",
    document_uploaded: "Document uploaded",
  };
  return actionMap[action] ?? sentenceCase(action);
}

function requestTone(action: string): HistoryTimelineTone {
  if (action === "approved" || action === "paid") {
    return "success";
  }
  if (action === "rejected" || action === "cancelled") {
    return "danger";
  }
  if (action === "reversed" || action === "restored") {
    return "warning";
  }
  if (action === "partially_paid" || action === "document_uploaded") {
    return "info";
  }
  return "neutral";
}

function requestEntryLabel(entry: RequestHistoryRecord) {
  if (entry.action === "document_uploaded") {
    return "Document";
  }
  if (entry.action === "partially_paid" || entry.action === "paid") {
    return "Payment";
  }
  return "Request Status";
}

export function mapRequestHistory(entries: RequestHistoryRecord[]) {
  return entries.map<HistoryTimelineEntry>((entry) => ({
    id: entry.id,
    label: requestEntryLabel(entry),
    title: requestActionLabel(entry.action),
    actorName: entry.performed_by_name || "System",
    createdAt: entry.created_at,
    body: entry.comment || undefined,
    statusText:
      entry.from_status || entry.to_status
        ? `${prettifyStatus(entry.from_status) || "N/A"} -> ${prettifyStatus(entry.to_status) || "N/A"}`
        : undefined,
    tone: requestTone(entry.action),
  }));
}

function invitationTone(actionType: string): HistoryTimelineTone {
  if (actionType === "approve") {
    return "success";
  }
  if (actionType === "reject") {
    return "danger";
  }
  if (actionType === "update") {
    return "info";
  }
  return "neutral";
}

export function mapInvitationHistory(entries: InvitationHistoryRecord[]) {
  return entries.map<HistoryTimelineEntry>((entry) => ({
    id: entry.id,
    label: entry.label || "Invitation Status",
    title: entry.action_label || sentenceCase(entry.action_type),
    actorName: entry.actor_name || "System",
    createdAt: entry.created_at,
    body: entry.comment || entry.description || undefined,
    statusText:
      entry.from_status || entry.to_status
        ? `${prettifyStatus(entry.from_status) || "N/A"} -> ${prettifyStatus(entry.to_status) || "N/A"}`
        : undefined,
    tone: invitationTone(entry.action_type),
  }));
}

function genericTone(entryType: string): HistoryTimelineTone {
  if (entryType === "approval_action") {
    return "success";
  }
  if (entryType === "revert_action") {
    return "warning";
  }
  if (entryType === "payment_action") {
    return "info";
  }
  if (entryType === "internal_note") {
    return "warning";
  }
  if (entryType === "director_comment" || entryType === "admin_note") {
    return "info";
  }
  return "neutral";
}

export function mapTimelineEntries(entries: RecordTimelineEntryRecord[]) {
  return entries.map<HistoryTimelineEntry>((entry) => ({
    id: entry.id,
    label: entry.label,
    title: entry.title,
    actorName: entry.actor_name || "System",
    createdAt: entry.created_at,
    body: entry.body || undefined,
    statusText:
      entry.old_status || entry.new_status
        ? `${prettifyStatus(entry.old_status) || "N/A"} -> ${prettifyStatus(entry.new_status) || "N/A"}`
        : undefined,
    tone: genericTone(entry.entry_type),
  }));
}
