import {
  Activity,
  Building2,
  Boxes,
  CalendarDays,
  CreditCard,
  FileText,
  Inbox,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShoppingCart,
  Users
} from "lucide-react";
import type { NavItem } from "../types";

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, group: "Core", requires: ["dashboard:view"] },
  { label: "Organization", href: "/organization", icon: Building2, group: "Core", requires: ["user:manage", "rbac:manage", "settings:update"] },
  { label: "Approvals", href: "/approvals", icon: Inbox, group: "Core", requires: ["procurement:approve", "payment_request:approve", "invoice:approve"] },
  { label: "Procurement", href: "/procurement", icon: ShoppingCart, group: "Operations", requires: ["procurement:view_all", "procurement:create", "purchase_order:view_all"] },
  { label: "Inventory", href: "/inventory", icon: Boxes, group: "Operations", requires: ["inventory:view", "goods_receipt:view", "goods_receipt:record"] },
  { label: "Finance", href: "/finance", icon: Landmark, group: "Operations", requires: ["finance:view", "payment:view", "payment:record"] },
  { label: "Requests", href: "/requests", icon: ReceiptText, group: "Requests", requires: ["request:view_all", "request:view_own", "payment:view", "payment:record"] },
  { label: "Invitations", href: "/invitations", icon: CalendarDays, group: "Requests", requires: ["invitation:view_all", "invitation:view_own"] },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, group: "Requests", requires: ["invitation:view_all", "invitation:view_own"] },
  { label: "Payments", href: "/payments", icon: CreditCard, group: "Requests", requires: ["payment:view", "payment:record"] },
  { label: "Reports", href: "/reports", icon: FileText, group: "Reporting", requires: ["report:view"] },
  { label: "Documents", href: "/documents", icon: FileText, group: "Records", requires: ["document:view_all", "document:view_own"] },
  { label: "Activity Logs", href: "/activity", icon: Activity, group: "Records", requires: ["audit:view"] },
  { label: "Administration Panel", href: "/admin", icon: Users, group: "Administration", requires: ["user:manage", "rbac:manage"] },
  { label: "System Settings", href: "/settings", icon: Settings, group: "Administration", requires: ["settings:update", "profile:change_password"] }
];
