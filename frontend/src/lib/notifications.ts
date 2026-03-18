import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { NotificationItem } from "../types";

export const ACTIONABLE_NOTIFICATION_TITLES = new Set([
  "Request submitted",
  "Pending approval",
  "Request approved",
  "Request rejected",
  "Payment recorded",
  "Invitation response",
  "Event reminder",
  "Overdue item",
]);

export type NotificationMeta = {
  icon: LucideIcon;
  accent: string;
  fallbackTitle: string;
};

export function getNotificationMeta(item: NotificationItem): NotificationMeta {
  const title = (item.title || "").toLowerCase();
  if (title.includes("approved")) {
    return { icon: CheckCircle2, accent: "text-emerald-600 dark:text-emerald-300", fallbackTitle: "Request approved" };
  }
  if (title.includes("rejected")) {
    return { icon: XCircle, accent: "text-rose-600 dark:text-rose-300", fallbackTitle: "Request rejected" };
  }
  if (title.includes("payment")) {
    return { icon: Wallet, accent: "text-cyan-700 dark:text-cyan-300", fallbackTitle: "Payment recorded" };
  }
  if (title.includes("invitation")) {
    return { icon: CalendarClock, accent: "text-blue-700 dark:text-blue-300", fallbackTitle: "Invitation update" };
  }
  if (title.includes("reminder")) {
    return { icon: Clock3, accent: "text-amber-700 dark:text-amber-300", fallbackTitle: "Event reminder" };
  }
  if (title.includes("pending")) {
    return { icon: Clock3, accent: "text-sky-700 dark:text-sky-300", fallbackTitle: "Pending approval" };
  }
  if (title.includes("overdue")) {
    return { icon: AlertTriangle, accent: "text-amber-700 dark:text-amber-300", fallbackTitle: "Overdue item" };
  }
  return { icon: Bell, accent: "text-slate-600 dark:text-slate-300", fallbackTitle: "System update" };
}

export function filterEssentialNotifications(notifications: NotificationItem[]) {
  return notifications.filter((item) => {
    if (item.kind === "audit") {
      return false;
    }
    if (!item.title) {
      return false;
    }
    return ACTIONABLE_NOTIFICATION_TITLES.has(item.title);
  });
}
