import { MessageSquareMore, NotebookPen } from "lucide-react";
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
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>

      {canAddComment || canAddInternalNote ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-wrap gap-2">
            {canAddComment ? (
              <button
                type="button"
                onClick={() => setMode("comment")}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  mode === "comment"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400/60 dark:bg-blue-500/10 dark:text-blue-200"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  mode === "internal_note"
                    ? "border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400/60 dark:bg-amber-500/10 dark:text-amber-200"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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
            className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {mode === "internal_note"
                ? "Internal notes are visible only to administrators and directors."
                : "Comments remain part of the permanent record history."}
            </p>
            <button
              type="button"
              disabled={isSubmitting || !body.trim()}
              onClick={() => void submit()}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-900"
            >
              {isSubmitting ? "Saving..." : mode === "internal_note" ? "Save Note" : "Add Comment"}
            </button>
          </div>
        </div>
      ) : null}

      <HistoryTimeline items={items} emptyMessage={emptyMessage} />
    </div>
  );
}
