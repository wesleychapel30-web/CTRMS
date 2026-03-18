import { formatDateTime } from "../lib/format";
import { filterEssentialNotifications, getNotificationMeta } from "../lib/notifications";
import type { NotificationItem } from "../types";

type NotificationDropdownProps = {
  isOpen: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  error: string | null;
  onClose: () => void;
  onItemClick: (item: NotificationItem) => void;
};

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

  const visibleNotifications = filterEssentialNotifications(notifications);
  const visibleUnreadCount = visibleNotifications.filter((item) => !item.is_read).length;

  return (
    <div className="absolute right-0 top-[calc(100%+0.6rem)] z-[80] w-[20rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-200 px-3.5 py-3 dark:border-slate-800">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">{visibleUnreadCount} unread</span>
          <button onClick={onClose} className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
            Close
          </button>
        </div>
      </div>
      <div className="max-h-[22rem] overflow-y-auto p-2">
        {error ? <p className="px-2 py-2 text-sm text-rose-600">{error}</p> : null}
        {!visibleNotifications.length ? <p className="px-2 py-2 text-sm text-slate-500 dark:text-slate-400">No notifications.</p> : null}
        <div className="space-y-1.5">
          {visibleNotifications.slice(0, 8).map((item) => {
            const meta = getNotificationMeta(item);
            const Icon = meta.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onItemClick(item)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left ${
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
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{item.title || meta.fallbackTitle}</p>
                    {!item.is_read ? <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> : null}
                  </div>
                  <p className="truncate text-xs text-slate-600 dark:text-slate-400">{item.message || meta.fallbackTitle}</p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">{formatDateTime(item.created_at)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
