import {
  Activity,
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Users,
  UserPlus2
} from "lucide-react";
import type { NavItem } from "../types";

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, group: "Core", requires: ["dashboard:view"] },
  { label: "Requests", href: "/requests", icon: ReceiptText, group: "Core", requires: ["request:view_all", "request:view_own", "payment:view", "payment:record"] },
  { label: "Create Request", href: "/requests/new", icon: UserPlus2, group: "Core", requires: ["request:create"] },
  { label: "Invitations", href: "/invitations", icon: CalendarDays, group: "Core", requires: ["invitation:view_all", "invitation:view_own"] },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, group: "Core", requires: ["invitation:view_all", "invitation:view_own"] },
  { label: "Payments", href: "/payments", icon: CreditCard, group: "Finance & Reporting", requires: ["payment:view", "payment:record"] },
  { label: "Reports", href: "/reports", icon: FileText, group: "Finance & Reporting", requires: ["report:view"] },
  { label: "Documents", href: "/documents", icon: FileText, group: "Records", requires: ["document:view_all", "document:view_own"] },
  { label: "Activity Logs", href: "/activity", icon: Activity, group: "Records", requires: ["audit:view"] },
  { label: "Administration Panel", href: "/admin", icon: Users, group: "Administration", requires: ["user:manage", "rbac:manage"] },
  { label: "System Settings", href: "/settings", icon: Settings, group: "Administration", requires: ["settings:update", "profile:change_password"] }
];
