import { useCallback, useEffect, useRef, useState } from "react";
import { fetchNotifications } from "./api";
import type { NotificationItem } from "../types";

const POLL_INTERVAL_MS = 30_000;

type UseNotificationPollResult = {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  markRead: (id: string) => void;
};

export function useNotificationPoll(
  onNew: (items: NotificationItem[]) => void,
): UseNotificationPollResult {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seenIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  const poll = useCallback(async (explicit: boolean) => {
    if (explicit) setIsLoading(true);
    try {
      const data = await fetchNotifications();
      const items: NotificationItem[] = data.notifications ?? [];
      setNotifications(items);
      setUnreadCount(data.unread_count ?? 0);
      setError(null);

      if (!initialized.current) {
        // Seed seen IDs on first load — don't fire alerts for pre-existing items
        for (const item of items) seenIds.current.add(item.id);
        initialized.current = true;
      } else {
        const newItems = items.filter((n) => !n.is_read && !seenIds.current.has(n.id));
        for (const item of items) seenIds.current.add(item.id);
        if (newItems.length > 0) onNewRef.current(newItems);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notifications");
    } finally {
      if (explicit) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void poll(true);
    const handle = window.setInterval(() => void poll(false), POLL_INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [poll]);

  const refresh = useCallback(() => { void poll(true); }, [poll]);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  return { notifications, unreadCount, isLoading, error, refresh, markRead };
}
