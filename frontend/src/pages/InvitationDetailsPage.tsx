import { CalendarDays, Download, FileText, MapPin, Share2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { AttachmentPreviewPanel } from "../components/AttachmentPreviewPanel";
import { DetailSectionCard } from "../components/DetailSectionCard";
import { StatePanel } from "../components/FeedbackStates";
import { RecordChatter } from "../components/RecordChatter";
import { StatusBadge } from "../components/StatusBadge";
import { useSession } from "../context/SessionContext";
import { useToast } from "../context/ToastContext";
import {
  acceptInvitation,
  addInvitationTimelineEntry,
  confirmInvitationAttendance,
  declineInvitation,
  fetchInvitation,
  revertInvitationDecision,
  uploadInvitationAttachment
} from "../lib/api";
import { getInvitationDecisionVisibility } from "../lib/invitationDecisionRules";
import { formatDateTime } from "../lib/format";
import type { InvitationRecord } from "../types";

type InvitationDecisionAction = "accept" | "decline" | "confirm" | "revert";

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unable to load invitation";
}

export function InvitationDetailsPage() {
  const { invitationId } = useParams();
  const { hasPermission, hasRole } = useSession();
  const toast = useToast();
  const [record, setRecord] = useState<InvitationRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [attachmentType, setAttachmentType] = useState("Supporting Document");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<{ title: string; fileName?: string; fileUrl: string } | null>(null);
  const [pendingDecisionAction, setPendingDecisionAction] = useState<InvitationDecisionAction | null>(null);
  const [isDecisionSubmitting, setIsDecisionSubmitting] = useState(false);
  const [isTimelineSubmitting, setIsTimelineSubmitting] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadInvitation = async () => {
    if (!invitationId) {
      return;
    }
    try {
      setIsLoading(true);
      const data = await fetchInvitation(invitationId);
      setLoadError(null);
      setRecord(data);
      setNotes(data.review_notes ?? "");
    } catch (reason: unknown) {
      setLoadError(getErrorMessage(reason));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadInvitation();
  }, [invitationId]);

  if (loadError) {
    return <StatePanel variant="error" title="Invitation unavailable" message={loadError} actionLabel="Retry" onAction={() => void loadInvitation()} />;
  }

  if (isLoading || !record) {
    return <StatePanel variant="loading" title="Loading invitation" message="Preparing event details, attachments, and decision history." />;
  }

  const isDirector = hasRole("director");
  const canAccept = isDirector && hasPermission("invitation:accept");
  const canDecline = isDirector && hasPermission("invitation:decline");
  const canConfirm = isDirector && hasPermission("invitation:confirm");
  const canRevert = hasPermission("invitation:revert");
  const canDecide = canAccept || canDecline || canConfirm || canRevert;
  const canUpload = hasPermission("invitation:upload_all") || hasPermission("invitation:upload_own");
  const decisionVisibility = getInvitationDecisionVisibility(record.status);
  const showAccept = canAccept && decisionVisibility.showAccept;
  const showDecline = canDecline && decisionVisibility.showDecline;
  const showConfirm = canConfirm && decisionVisibility.showConfirm;
  const showRevert = canRevert && decisionVisibility.showRevert;
  const showFinalDecisionMessage = decisionVisibility.isFinal && !showRevert;
  const canComposeTimeline = hasRole("director") || hasRole("admin");
  const primaryAttachment = record.attachments[0];

  const contextCards = useMemo(
    () => [
      {
        label: "Organizer",
        value: record.inviting_organization,
        note: record.contact_person || "Primary organizer"
      },
      {
        label: "Event Date",
        value: new Date(record.event_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        }),
        note: formatDateTime(record.event_date)
      },
      {
        label: "Invitation Type",
        value: record.rsvp_required ? "RSVP Required" : "Standard Invitation",
        note: record.special_requirements || "No special requirements"
      }
    ],
    [record]
  );

  const successMessages: Record<InvitationDecisionAction, { title: string; message: string }> = {
    accept: { title: "Invitation accepted", message: "Invitation accepted successfully." },
    decline: { title: "Invitation declined", message: "Invitation declined successfully." },
    confirm: { title: "Attendance confirmed", message: "Attendance confirmed successfully." },
    revert: { title: "Decision reverted", message: "Invitation decision reverted successfully." }
  };

  const runDecisionAction = async (action: InvitationDecisionAction) => {
    setIsDecisionSubmitting(true);
    try {
      if (action === "accept") {
        await acceptInvitation(record.id, notes);
      } else if (action === "decline") {
        await declineInvitation(record.id, notes);
      } else if (action === "confirm") {
        await confirmInvitationAttendance(record.id);
      } else {
        await revertInvitationDecision(record.id, notes);
      }
      await loadInvitation();
      const success = successMessages[action];
      toast.success(success.message, success.title);
      setPendingDecisionAction(null);
    } catch (reason: unknown) {
      toast.error(getErrorMessage(reason));
    } finally {
      setIsDecisionSubmitting(false);
    }
  };

  const submitTimelineEntry = async (payload: { mode: "comment" | "internal_note"; body: string }) => {
    setIsTimelineSubmitting(true);
    try {
      await addInvitationTimelineEntry(record.id, payload);
      await loadInvitation();
      toast.success(
        payload.mode === "internal_note" ? "Internal note saved." : "Comment added successfully.",
        payload.mode === "internal_note" ? "Note saved" : "Comment added"
      );
    } catch (reason: unknown) {
      toast.error(getErrorMessage(reason));
      throw reason;
    } finally {
      setIsTimelineSubmitting(false);
    }
  };

  const uploadAttachment = async () => {
    if (!attachment) {
      return;
    }
    setIsUploadingAttachment(true);
    try {
      await uploadInvitationAttachment(record.id, attachment, attachmentType);
      await loadInvitation();
      setAttachment(null);
      toast.success("Attachment uploaded successfully.", "Attachment added");
    } catch (reason: unknown) {
      toast.error(getErrorMessage(reason));
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <section className="hero-card overflow-hidden rounded-xl p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-kicker">Invitations / {record.id.slice(0, 8)}</p>
              <h2 className="headline-font mt-3 text-4xl font-extrabold tracking-[-0.06em] text-[var(--ink)]">
                {record.event_title}
              </h2>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <StatusBadge status={record.status_display} />
                <span className="text-sm text-[var(--muted)]">
                  Submitted {record.created_at ? formatDateTime(record.created_at) : "recently"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {primaryAttachment ? (
                <button
                  type="button"
                  onClick={() =>
                    setPreviewFile({
                      title: primaryAttachment.attachment_type,
                      fileName: primaryAttachment.filename,
                      fileUrl: primaryAttachment.download_url ?? primaryAttachment.file
                    })
                  }
                  className="secondary-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
                >
                  <FileText className="h-4 w-4" />
                  Preview
                </button>
              ) : null}
              <button type="button" className="secondary-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold">
                <Share2 className="h-4 w-4" />
                Share
              </button>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl">
            {primaryAttachment ? (
              <div className="dark-hero-card flex min-h-[14rem] items-end p-6">
                <div>
                  <p className="section-kicker text-white/55">Attachment Preview</p>
                  <p className="headline-font mt-3 text-2xl font-bold tracking-[-0.04em] text-white">
                    {primaryAttachment.attachment_type}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    {primaryAttachment.filename || "Uploaded document"} · Open from the attachment panel for the full file.
                  </p>
                </div>
              </div>
            ) : (
              <div className="dark-hero-card flex min-h-[14rem] items-end p-6">
                <div>
                  <p className="section-kicker text-white/55">Event Record</p>
                  <p className="headline-font mt-3 text-2xl font-bold tracking-[-0.04em] text-white">{record.location}</p>
                  <p className="mt-2 text-sm text-white/70">
                    {record.inviting_organization} · {formatDateTime(record.event_date)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-px overflow-hidden rounded-xl bg-[var(--surface-container)] md:grid-cols-3">
            {contextCards.map((item) => (
              <div key={item.label} className="bg-[var(--surface-card)] px-5 py-4">
                <p className="section-kicker">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{item.value}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{item.note}</p>
              </div>
            ))}
          </div>
        </section>

        <DetailSectionCard title="Description & Objectives">
          <div className="space-y-4 text-sm leading-7 text-[var(--muted)]">
            <p>{record.description}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <InlineFact label="Location" value={record.location} icon={<MapPin className="h-4 w-4" />} />
              <InlineFact label="Schedule" value={formatDateTime(record.event_date)} icon={<CalendarDays className="h-4 w-4" />} />
              <InlineFact label="Contact" value={record.contact_person || "Not provided"} />
              <InlineFact label="Email" value={record.contact_email || "Not provided"} />
            </div>
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="Invitation History" subtitle="Permanent comments, decision history, and workflow notes.">
          <RecordChatter
            title="Record History"
            subtitle="Persistent decision notes and event updates for this invitation."
            entries={record.timeline_entries ?? []}
            emptyMessage="No invitation history is available yet."
            canAddComment={canComposeTimeline}
            canAddInternalNote={canComposeTimeline}
            isSubmitting={isTimelineSubmitting}
            onSubmit={submitTimelineEntry}
          />
        </DetailSectionCard>
      </div>

      <div className="space-y-6">
        <section className="slate-rail rounded-xl p-6">
          <p className="section-kicker text-white/55">Decision Actions</p>
          {canDecide ? (
            <div className="mt-5 space-y-3">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                className="w-full rounded-md border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40"
                placeholder="Type the director or administrator note for this decision."
              />

              {showAccept ? (
                <button
                  type="button"
                  disabled={isDecisionSubmitting}
                  onClick={() => setPendingDecisionAction("accept")}
                  className="w-full rounded-md bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/16 disabled:opacity-60"
                >
                  {isDecisionSubmitting && pendingDecisionAction === "accept" ? "Processing..." : "Accept Invitation"}
                </button>
              ) : null}

              {showConfirm ? (
                <button
                  type="button"
                  disabled={isDecisionSubmitting}
                  onClick={() => setPendingDecisionAction("confirm")}
                  className="w-full rounded-md bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/16 disabled:opacity-60"
                >
                  {isDecisionSubmitting && pendingDecisionAction === "confirm" ? "Processing..." : "Confirm Attendance"}
                </button>
              ) : null}

              {showRevert ? (
                <button
                  type="button"
                  disabled={isDecisionSubmitting}
                  onClick={() => setPendingDecisionAction("revert")}
                  className="w-full rounded-md border border-white/10 px-4 py-3 text-left text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isDecisionSubmitting && pendingDecisionAction === "revert" ? "Processing..." : "Revert Decision"}
                </button>
              ) : null}

              {showDecline ? (
                <button
                  type="button"
                  disabled={isDecisionSubmitting}
                  onClick={() => setPendingDecisionAction("decline")}
                  className="w-full rounded-md border border-[rgba(235,87,87,0.35)] px-4 py-3 text-left text-sm font-semibold text-[#ffb8b2] disabled:opacity-60"
                >
                  {isDecisionSubmitting && pendingDecisionAction === "decline" ? "Processing..." : "Decline Invitation"}
                </button>
              ) : null}

              {showFinalDecisionMessage ? (
                <div className="rounded-md border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/78">
                  Final decision recorded. Current status: <span className="font-semibold text-white">{record.status_display}</span>.
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 rounded-md border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
              Only the Director can accept, decline, or confirm invitations.
            </p>
          )}
        </section>

        <DetailSectionCard title="Institutional Context">
          <div className="space-y-3">
            <InfoRow label="Status" value={record.status_display} />
            <InfoRow label="RSVP" value={record.rsvp_required ? "Required" : "Not required"} />
            <InfoRow label="Expected attendees" value={record.expected_attendees ? String(record.expected_attendees) : "Not specified"} />
            <InfoRow label="Special requirements" value={record.special_requirements || "No additional requirements"} />
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="Attachments">
          <div className="space-y-3">
            {record.attachments.length ? (
              record.attachments.map((file) => (
                <div key={file.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-low)] px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--ink)]">{file.attachment_type}</p>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      {file.filename || "Uploaded file"} · {formatDateTime(file.uploaded_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewFile({
                          title: file.attachment_type,
                          fileName: file.filename,
                          fileUrl: file.download_url ?? file.file
                        })
                      }
                      className="secondary-button rounded-md px-3 py-1.5 text-xs font-semibold"
                    >
                      Preview
                    </button>
                    <a
                      href={file.download_url ?? file.file}
                      target="_blank"
                      rel="noreferrer"
                      className="primary-button inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No attachments uploaded yet.</p>
            )}
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="Add Attachment">
          {canUpload ? (
            <div className="space-y-3">
              <label className="grid gap-2">
                <span className="section-kicker">Attachment Type</span>
                <input
                  value={attachmentType}
                  onChange={(event) => setAttachmentType(event.target.value)}
                  className="institutional-input rounded-md px-4 py-3 outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="section-kicker">Document</span>
                <input
                  onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                  type="file"
                  className="institutional-input rounded-md border-dashed px-4 py-4 outline-none"
                />
              </label>
              <button
                type="button"
                disabled={isUploadingAttachment || !attachment}
                onClick={() => void uploadAttachment()}
                className="primary-button w-full rounded-md px-4 py-3 text-sm font-semibold disabled:opacity-60"
              >
                {isUploadingAttachment ? "Uploading..." : "Upload Attachment"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">You do not have permission to upload attachments for this invitation.</p>
          )}
        </DetailSectionCard>
      </div>

      <AttachmentPreviewPanel
        isOpen={Boolean(previewFile)}
        title={previewFile?.title ?? "Attachment Preview"}
        fileName={previewFile?.fileName}
        fileUrl={previewFile?.fileUrl ?? ""}
        onClose={() => setPreviewFile(null)}
      />

      {pendingDecisionAction ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {pendingDecisionAction === "revert" ? "Revert Decision?" : "Confirm Action"}
            </h4>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {pendingDecisionAction === "revert"
                ? "This will return the record to the previous review stage and restore available decision options."
                : pendingDecisionAction === "accept"
                  ? "Accept this invitation? This moves it to Accepted."
                  : pendingDecisionAction === "decline"
                    ? "Decline this invitation? This moves it to Declined."
                    : "Confirm attendance for this invitation? This moves it to Confirmed Attendance."}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDecisionAction(null)}
                disabled={isDecisionSubmitting}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runDecisionAction(pendingDecisionAction)}
                disabled={isDecisionSubmitting}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-900"
              >
                {isDecisionSubmitting ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InlineFact({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-[var(--surface-low)] px-4 py-3">
      {icon ? <span className="mt-0.5 text-[var(--accent)]">{icon}</span> : null}
      <div>
        <p className="section-kicker">{label}</p>
        <p className="mt-1 text-sm font-medium text-[var(--ink)]">{value}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-[var(--surface-low)] px-4 py-3">
      <span className="section-kicker">{label}</span>
      <span className="text-sm font-medium text-[var(--ink)]">{value}</span>
    </div>
  );
}
