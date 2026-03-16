import { AlertTriangle, Bell, CalendarClock, CheckCircle2, Clock3, Wallet, XCircle } from "lucide-react";
import { formatDateTime } from "../lib/format";
import type { NotificationItem } from "../types";

type NotificationDropdownProps = {
  isOpen: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  error: string | null;
  onClose: () => void;
  onItemClick: (item: NotificationItem) => void;
};

const ACTIONABLE_TITLES = new Set([
  "Request submitted",
  "Pending approval",
  "Request approved",
  "Request rejected",
  "Payment recorded",
  "Invitation response",
  "Event reminder",
  "Overdue item"
]);

function getNotificationMeta(item: NotificationItem) {
  const title = (item.title || "").toLowerCase();
  if (title.includes("approved")) return { icon: CheckCircle2, accent: "text-emerald-600 dark:text-emerald-300", hint: "Request approved" };
  if (title.includes("rejected")) return { icon: XCircle, accent: "text-rose-600 dark:text-rose-300", hint: "Request rejected" };
  if (title.includes("payment")) return { icon: Wallet, accent: "text-cyan-700 dark:text-cyan-300", hint: "Payment recorded" };
  if (title.includes("invitation")) return { icon: CalendarClock, accent: "text-blue-700 dark:text-blue-300", hint: "Invitation update" };
  if (title.includes("reminder")) return { icon: Clock3, accent: "text-amber-700 dark:text-amber-300", hint: "Event reminder" };
  if (title.includes("pending")) return { icon: Clock3, accent: "text-sky-700 dark:text-sky-300", hint: "Pending approval" };
  if (title.includes("overdue")) return { icon: AlertTriangle, accent: "text-amber-700 dark:text-amber-300", hint: "Overdue item" };
  return { icon: Bell, accent: "text-slate-600 dark:text-slate-300", hint: "System update" };
}

export function NotificationDropdown({
  isOpen,
  notifications,
  unreadCount,
  error,
  onClose,
  onItemClick
}: NotificationDropdownProps) {
  if (!isOpen) {
    return null;
  }

  const visibleNotifications = notifications.filter((item) => {
    if (item.kind === "audit") {
      return false;
    }
    if (!item.title) {
      return false;
    }
    return ACTIONABLE_TITLES.has(item.title);
  });
  const visibleUnreadCount = visibleNotifications.filter((item) => !item.is_read).length;

  return (
    <div className="absolute right-0 top-12 z-50 w-[22rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">{visibleUnreadCount} unread</span>
          <button onClick={onClose} className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
            Close
          </button>
        </div>
      </div>
      <div className="max-h-[26rem] overflow-y-auto p-2">
        {error ? <p className="px-2 py-2 text-sm text-rose-600">{error}</p> : null}
        {!visibleNotifications.length ? <p className="px-2 py-2 text-sm text-slate-500 dark:text-slate-400">No notifications.</p> : null}
        <div className="space-y-1">
          {visibleNotifications.slice(0, 10).map((item) => {
            const meta = getNotificationMeta(item);
            const Icon = meta.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onItemClick(item)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left ${
                  item.is_read
                    ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                    : "border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30"
                }`}
              >
                <div className={`mt-0.5 ${meta.accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-left">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{item.title || meta.hint}</p>
                    {!item.is_read ? <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> : null}
                  </div>
                  <p className="truncate text-xs text-slate-600 dark:text-slate-400">{item.message || meta.hint}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-500">{formatDateTime(item.created_at)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
