import { LoaderCircle, MessageSquareMore, NotebookPen } from "lucide-react";
import { useMemo, useState } from "react";
import { HistoryTimeline } from "./HistoryTimeline";
import { mapTimelineEntries } from "../lib/historyTimeline";
import type { RecordTimelineEntryRecord } from "../types";

type ComposerMode = "comment" | "internal_note";

type RecordChatterProps = {
  title: string;
  subtitle: string;
  entries: RecordTimelineEntryRecord[];
  emptyMessage: string;
  canAddComment: boolean;
  canAddInternalNote: boolean;
  isSubmitting: boolean;
  onSubmit: (payload: { mode: ComposerMode; body: string }) => Promise<void>;
};

export function RecordChatter({
  title,
  subtitle,
  entries,
  emptyMessage,
  canAddComment,
  canAddInternalNote,
  isSubmitting,
  onSubmit,
}: RecordChatterProps) {
  const [mode, setMode] = useState<ComposerMode>(canAddComment ? "comment" : "internal_note");
  const [body, setBody] = useState("");
  const items = useMemo(() => mapTimelineEntries(entries), [entries]);

  const submit = async () => {
    const text = body.trim();
    if (!text) {
      return;
    }
    await onSubmit({ mode, body: text });
    setBody("");
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="headline-font text-base font-bold tracking-[-0.03em] text-[var(--ink)]">{title}</h3>
        <p className="mt-1 text-sm font-medium text-[var(--muted)]">{subtitle}</p>
      </div>

      {canAddComment || canAddInternalNote ? (
        <div className="rounded-lg bg-[var(--surface-low)] p-4">
          <div className="flex flex-wrap gap-2">
            {canAddComment ? (
              <button
                type="button"
                onClick={() => setMode("comment")}
                className={`inline-flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-semibold ${
                  mode === "comment"
                    ? "bg-[var(--surface-card)] text-[var(--accent)]"
                    : "bg-transparent text-[var(--muted)]"
                }`}
              >
                <MessageSquareMore className="h-4 w-4" />
                Add Comment
              </button>
            ) : null}
            {canAddInternalNote ? (
              <button
                type="button"
                onClick={() => setMode("internal_note")}
                className={`inline-flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-semibold ${
                  mode === "internal_note"
                    ? "bg-[var(--surface-card)] text-[var(--warning)]"
                    : "bg-transparent text-[var(--muted)]"
                }`}
              >
                <NotebookPen className="h-4 w-4" />
                Log Internal Note
              </button>
            ) : null}
          </div>

          <textarea
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={mode === "internal_note" ? "Add an internal note for administrators and directors." : "Add a record comment."}
            className="institutional-input mt-3 w-full rounded-md px-4 py-3 text-sm outline-none"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-[var(--muted)]">
              {mode === "internal_note"
                ? "Internal notes are visible only to administrators and directors."
                : "Comments remain part of the permanent record history."}
            </p>
            <button
              type="button"
              disabled={isSubmitting || !body.trim()}
              onClick={() => void submit()}
              className="primary-button inline-flex items-center gap-2 rounded-sm px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Saving..." : mode === "internal_note" ? "Save Note" : "Add Comment"}
            </button>
          </div>
        </div>
      ) : null}

      <HistoryTimeline items={items} emptyMessage={emptyMessage} />
    </div>
  );
}
