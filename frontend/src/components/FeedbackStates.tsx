import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Info,
  LoaderCircle,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type BannerVariant = "error" | "warning" | "info" | "success";
type StateVariant = "loading" | "error" | "empty" | "info";

const bannerMeta: Record<
  BannerVariant,
  {
    icon: LucideIcon;
    shell: string;
    iconTone: string;
    titleTone: string;
    actionTone: string;
  }
> = {
  error: {
    icon: AlertCircle,
    shell: "border-rose-200/80 bg-rose-50/90 dark:border-rose-500/20 dark:bg-rose-500/10",
    iconTone: "text-rose-600 dark:text-rose-300",
    titleTone: "text-rose-900 dark:text-rose-100",
    actionTone: "text-rose-700 hover:text-rose-900 dark:text-rose-200 dark:hover:text-white",
  },
  warning: {
    icon: AlertTriangle,
    shell: "border-amber-200/80 bg-amber-50/90 dark:border-amber-500/20 dark:bg-amber-500/10",
    iconTone: "text-amber-600 dark:text-amber-300",
    titleTone: "text-amber-900 dark:text-amber-100",
    actionTone: "text-amber-700 hover:text-amber-900 dark:text-amber-200 dark:hover:text-white",
  },
  info: {
    icon: Info,
    shell: "border-sky-200/80 bg-sky-50/90 dark:border-sky-500/20 dark:bg-sky-500/10",
    iconTone: "text-sky-600 dark:text-sky-300",
    titleTone: "text-sky-900 dark:text-sky-100",
    actionTone: "text-sky-700 hover:text-sky-900 dark:text-sky-200 dark:hover:text-white",
  },
  success: {
    icon: CheckCircle2,
    shell: "border-emerald-200/80 bg-emerald-50/90 dark:border-emerald-500/20 dark:bg-emerald-500/10",
    iconTone: "text-emerald-600 dark:text-emerald-300",
    titleTone: "text-emerald-900 dark:text-emerald-100",
    actionTone: "text-emerald-700 hover:text-emerald-900 dark:text-emerald-200 dark:hover:text-white",
  },
};

const stateMeta: Record<
  StateVariant,
  {
    icon: LucideIcon;
    tone: string;
  }
> = {
  loading: { icon: LoaderCircle, tone: "text-[var(--accent)]" },
  error: { icon: AlertCircle, tone: "text-[var(--danger)]" },
  empty: { icon: Inbox, tone: "text-[var(--muted)]" },
  info: { icon: Info, tone: "text-[var(--accent)]" },
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type InlineBannerProps = {
  variant: BannerVariant;
  title: string;
  message: string;
  className?: string;
  actionLabel?: string;
  onAction?: () => void;
  trailing?: ReactNode;
};

export function InlineBanner({
  variant,
  title,
  message,
  className,
  actionLabel,
  onAction,
  trailing,
}: InlineBannerProps) {
  const meta = bannerMeta[variant];
  const Icon = meta.icon;

  return (
    <div className={joinClasses("feedback-enter rounded-xl border px-4 py-3", meta.shell, className)}>
      <div className="flex items-start gap-3">
        <div className={joinClasses("mt-0.5 rounded-full p-1.5", meta.iconTone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={joinClasses("text-sm font-semibold", meta.titleTone)}>{title}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{message}</p>
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className={joinClasses("mt-3 inline-flex items-center gap-2 text-xs font-semibold", meta.actionTone)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {actionLabel}
            </button>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </div>
  );
}

type StatePanelProps = {
  variant: StateVariant;
  title: string;
  message: string;
  className?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

export function StatePanel({
  variant,
  title,
  message,
  className,
  actionLabel,
  onAction,
  compact = false,
}: StatePanelProps) {
  const meta = stateMeta[variant];
  const Icon = meta.icon;

  return (
    <div
      className={joinClasses(
        "surface-panel feedback-enter rounded-xl border border-[var(--line)] bg-[var(--surface-card)]",
        compact ? "px-5 py-5" : "px-6 py-7",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className={joinClasses("grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--surface-low)]", meta.tone)}>
          <Icon className={joinClasses("h-5 w-5", variant === "loading" && "animate-spin")} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="headline-font text-lg font-bold tracking-[-0.03em] text-[var(--ink)]">{title}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{message}</p>
          {variant === "loading" ? (
            <div className="mt-4 space-y-2.5">
              <div className="feedback-skeleton h-2.5 w-40 rounded-full" />
              <div className="feedback-skeleton h-2.5 w-full rounded-full" />
              <div className="feedback-skeleton h-2.5 w-4/5 rounded-full" />
            </div>
          ) : null}
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="secondary-button mt-4 inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold"
            >
              <RefreshCw className="h-4 w-4" />
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type TableSkeletonProps = {
  columns?: number;
  rows?: number;
  message?: string;
};

export function TableSkeleton({
  columns = 5,
  rows = 5,
  message = "Loading records...",
}: TableSkeletonProps) {
  return (
    <div className="surface-panel feedback-enter overflow-hidden rounded-xl border border-[var(--line)]" aria-busy="true">
      <div className="flex gap-4 bg-[var(--surface-low)] px-6 py-4">
        {Array.from({ length: columns }).map((_, index) => (
          <div key={`header-${index}`} className="feedback-skeleton h-3 flex-1 rounded-full" />
        ))}
      </div>
      <div className="divide-y divide-[var(--line)]">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex gap-4 px-6 py-4">
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <div
                key={`cell-${rowIndex}-${columnIndex}`}
                className={joinClasses(
                  "feedback-skeleton h-3 rounded-full",
                  columnIndex === 0 ? "flex-[1.4]" : "flex-1"
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="bg-[var(--surface-low)] px-6 py-3 text-sm text-[var(--muted)]">{message}</div>
    </div>
  );
}
