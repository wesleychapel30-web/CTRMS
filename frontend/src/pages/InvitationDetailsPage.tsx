import { Download, FileText, MapPin } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { AttachmentPreviewPanel } from "../components/AttachmentPreviewPanel";
import { DetailSectionCard } from "../components/DetailSectionCard";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { useSession } from "../context/SessionContext";
import {
  acceptInvitation,
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

export function InvitationDetailsPage() {
  const { invitationId } = useParams();
  const { user, hasPermission } = useSession();
  const [record, setRecord] = useState<InvitationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [attachmentType, setAttachmentType] = useState("Supporting Document");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<{ title: string; fileName?: string; fileUrl: string } | null>(null);
  const [pendingDecisionAction, setPendingDecisionAction] = useState<InvitationDecisionAction | null>(null);
  const [isDecisionSubmitting, setIsDecisionSubmitting] = useState(false);

  const loadInvitation = async () => {
    if (!invitationId) {
      return;
    }
    try {
      const data = await fetchInvitation(invitationId);
      setRecord(data);
      setNotes(data.review_notes ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load invitation");
    }
  };

  useEffect(() => {
    void loadInvitation();
  }, [invitationId]);

  if (error) {
    return <SectionCard title="Invitation Details">{error}</SectionCard>;
  }

  if (!record) {
    return <SectionCard title="Invitation Details">Loading invitation...</SectionCard>;
  }

  const isDirector = user?.role === "director";
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

  const runDecisionAction = async (action: InvitationDecisionAction) => {
    setError(null);
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
      setPendingDecisionAction(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update invitation decision");
    } finally {
      setIsDecisionSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <DetailSectionCard title="Event Information">
          <div className="grid gap-4 md:grid-cols-2">
            <Detail label="Organization" value={record.inviting_organization} />
            <Detail label="Contact Person" value={record.contact_person} />
            <Detail label="Contact Details" value={`${record.contact_phone} | ${record.contact_email}`} />
            <Detail label="Event Title" value={record.event_title} />
            <Detail label="Event Date & Time" value={formatDateTime(record.event_date)} />
            <Detail label="Location" value={<span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> {record.location}</span>} />
            <Detail label="Status" value={<StatusBadge status={record.status_display} />} />
            <Detail label="Duration" value={`${record.event_duration_hours} hours`} />
          </div>
          <div className="mt-4 rounded-3xl bg-slate-100/70 p-4 text-sm leading-7 text-slate-600 dark:bg-white/5 dark:text-slate-300">
            {record.description}
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="Attachments">
          <div className="space-y-3">
            {record.attachments.length ? (
              record.attachments.map((file) => (
                <div key={file.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-cyan-100 p-2.5 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{file.attachment_type}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(file.uploaded_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewFile({ title: file.attachment_type, fileName: file.filename, fileUrl: file.download_url ?? file.file })}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
                    >
                      Preview
                    </button>
                    <a
                      href={file.download_url ?? file.file}
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
              <p className="text-sm text-slate-500">No attachments uploaded yet.</p>
            )}
          </div>
        </DetailSectionCard>
      </div>

      <div className="space-y-6">
        <DetailSectionCard title="Decision Section">
          {canDecide ? (
            <div className="space-y-3">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                placeholder="Notes (optional)"
              />
              {showAccept ? (
                <button
                  type="button"
                  disabled={isDecisionSubmitting}
                  onClick={() => setPendingDecisionAction("accept")}
                  className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isDecisionSubmitting && pendingDecisionAction === "accept" ? "Processing..." : "Accept Invitation"}
                </button>
              ) : null}
              {showDecline ? (
                <button
                  type="button"
                  disabled={isDecisionSubmitting}
                  onClick={() => setPendingDecisionAction("decline")}
                  className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isDecisionSubmitting && pendingDecisionAction === "decline" ? "Processing..." : "Decline Invitation"}
                </button>
              ) : null}
              {showConfirm ? (
                <button
                  type="button"
                  disabled={isDecisionSubmitting}
                  onClick={() => setPendingDecisionAction("confirm")}
                  className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-blue-500"
                >
                  {isDecisionSubmitting && pendingDecisionAction === "confirm" ? "Processing..." : "Confirm Attendance"}
                </button>
              ) : null}
              {showRevert ? (
                <button
                  type="button"
                  disabled={isDecisionSubmitting}
                  onClick={() => setPendingDecisionAction("revert")}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold disabled:opacity-60 dark:border-white/10"
                >
                  {isDecisionSubmitting && pendingDecisionAction === "revert" ? "Processing..." : "Revert Decision"}
                </button>
              ) : null}
              {showFinalDecisionMessage ? (
                <p className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  Final decision recorded. Current status: <span className="font-semibold">{record.status_display}</span>.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Only the Director can accept, decline, or confirm invitations.
            </p>
          )}
        </DetailSectionCard>

        <DetailSectionCard title="Add Attachment">
          {canUpload ? (
            <div className="space-y-3">
              <input value={attachmentType} onChange={(event) => setAttachmentType(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5" />
              <input onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} type="file" className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 outline-none dark:border-white/10 dark:bg-white/5" />
              <button
                onClick={() => attachment && void uploadInvitationAttachment(record.id, attachment, attachmentType).then(loadInvitation).catch((reason) => setError(reason.message))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-white/10"
              >
                Upload Attachment
              </button>
            </div>
          ) : (
            <p className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              You do not have permission to upload attachments for this invitation.
            </p>
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

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
