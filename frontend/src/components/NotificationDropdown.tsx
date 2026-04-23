import { formatDateTime } from "../lib/format";
import { filterEssentialNotifications, getNotificationMeta } from "../lib/notifications";
import type { NotificationItem } from "../types";
import { InlineBanner } from "./FeedbackStates";

type NotificationDropdownProps = {
  isOpen: boolean;
  isLoading: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  error: string | null;
  onClose: () => void;
  onItemClick: (item: NotificationItem) => void;
};

export function NotificationDropdown({
  isOpen,
  isLoading,
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
    <div className="surface-panel dropdown-enter absolute right-0 top-[calc(100%+0.75rem)] z-[80] w-[21rem] overflow-hidden rounded-xl">
      <div className="flex items-center justify-between bg-[var(--surface-low)] px-4 py-3">
        <p className="headline-font text-sm font-bold text-[var(--ink)]">Notifications</p>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{visibleUnreadCount} unread</span>
          <button onClick={onClose} className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
            Close
          </button>
        </div>
      </div>
      <div className="max-h-[22rem] overflow-y-auto p-2">
        {error ? <InlineBanner variant="error" title="Notifications unavailable" message={error} className="m-1" /> : null}
        {!error && isLoading ? (
          <div className="space-y-2 p-1" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`notification-skeleton-${index}`} className="rounded-lg bg-[var(--surface-low)] px-3 py-3">
                <div className="flex items-start gap-3">
                  <div className="feedback-skeleton h-4 w-4 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="feedback-skeleton h-3 w-2/3 rounded-full" />
                    <div className="feedback-skeleton h-2.5 w-full rounded-full" />
                    <div className="feedback-skeleton h-2.5 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {!error && !isLoading && !visibleNotifications.length ? (
          <div className="px-3 py-4 text-sm text-[var(--muted)]">No notifications.</div>
        ) : null}
        {!error && !isLoading ? (
          <div className="space-y-1.5">
            {visibleNotifications.slice(0, 8).map((item) => {
              const meta = getNotificationMeta(item);
              const Icon = meta.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onItemClick(item)}
                  className={`interactive-lift interactive-press flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left ${
                    item.is_read ? "bg-[var(--surface-card)]" : "bg-[var(--surface-low)]"
                  }`}
                >
                  <div className={`mt-0.5 ${meta.accent}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-left">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">{item.title || meta.fallbackTitle}</p>
                      {!item.is_read ? <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> : null}
                    </div>
                    <p className="truncate text-xs text-[var(--muted)]">{item.message || meta.fallbackTitle}</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">{formatDateTime(item.created_at)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
