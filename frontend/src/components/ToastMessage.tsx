import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, type CSSProperties } from "react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastRecord = {
  id: string;
  title: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
  isClosing?: boolean;
};

type ToastMessageProps = {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
};

const variantMeta: Record<
  ToastVariant,
  { icon: typeof CheckCircle2; shell: string; iconColor: string; progress: string }
> = {
  success: {
    icon: CheckCircle2,
    shell: "bg-[var(--status-success-bg)] border-[var(--success)]/40",
    iconColor: "text-[var(--success)]",
    progress: "bg-[var(--success)]/80",
  },
  error: {
    icon: AlertCircle,
    shell: "bg-[var(--status-danger-bg)] border-[var(--danger)]/40",
    iconColor: "text-[var(--danger)]",
    progress: "bg-[var(--danger)]/80",
  },
  warning: {
    icon: AlertTriangle,
    shell: "bg-[var(--status-warning-bg)] border-[var(--warning)]/40",
    iconColor: "text-[var(--warning)]",
    progress: "bg-[var(--warning)]/80",
  },
  info: {
    icon: Info,
    shell: "bg-[var(--surface-card)] border-[var(--accent)]/30",
    iconColor: "text-[var(--accent)]",
    progress: "bg-[var(--accent)]/80",
  },
};

export function ToastMessage({ toast, onDismiss }: ToastMessageProps) {
  useEffect(() => {
    const handle = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(handle);
  }, [onDismiss, toast.durationMs, toast.id]);

  const meta = variantMeta[toast.variant];
  const Icon = meta.icon;
  const progressStyle = { animationDuration: `${toast.durationMs}ms` } as CSSProperties;

  return (
    <div
      data-testid={`toast-${toast.variant}`}
      className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg shadow-black/10 transition-all duration-200 ${
        toast.isClosing ? "toast-exit" : "toast-enter"
      } ${meta.shell}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.iconColor}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--ink)]">{toast.title}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="rounded-full p-1 text-[var(--muted)] transition hover:bg-[var(--surface-low)] hover:text-[var(--ink)]"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--surface-container)]">
        <div
          className={`toast-progress-bar h-full origin-left rounded-full ${meta.progress}`}
          style={progressStyle}
        />
      </div>
    </div>
  );
}
