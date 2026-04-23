import { Building2 } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { BrandingSettings, NavItem, SessionUser } from "../types";

type SidebarProps = {
  items: NavItem[];
  user: SessionUser | null;
  branding: BrandingSettings | null;
  onLogout: () => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
};

const GROUP_ORDER = ["Core", "Operations", "Requests", "Reporting", "Records", "Administration"] as const;

export function Sidebar({ items, user, branding, onLogout, isOpen, onClose }: SidebarProps) {
  const orderedGroups = [...GROUP_ORDER, ...items.map((item) => item.group ?? "General")].filter(
    (group, index, collection) => collection.indexOf(group) === index
  );
  const grouped = orderedGroups
    .map((group) => ({
      group,
      items: items.filter((item) => (item.group ?? "General") === group)
    }))
    .filter((entry) => entry.items.length > 0);

  const roleLabelMap: Record<string, string> = {
    super_admin: "Super Admin",
    department_manager: "Department Manager",
    procurement_officer: "Procurement Officer",
    standard_employee: "Standard Employee",
    director: "Director",
    admin: "Administrator",
    staff: "Staff",
    finance_officer: "Finance Officer",
    hr_officer: "HR Officer",
    operations_officer: "Operations Officer",
    compliance_officer: "Compliance Officer",
    customer_service_officer: "Customer Service Officer",
    auditor: "Auditor",
    it_admin: "IT Administrator",
  };
  const prioritizedRoles = [
    "super_admin",
    "director",
    "admin",
    "department_manager",
    "procurement_officer",
    "finance_officer",
    "operations_officer",
    "compliance_officer",
    "customer_service_officer",
    "hr_officer",
    "it_admin",
    "auditor",
    "standard_employee",
    "staff",
  ];
  const roleKeys = [...new Set([...(user?.roles ?? []), user?.role].filter(Boolean))];
  const primaryVisibleRole = prioritizedRoles.find((role) => roleKeys.includes(role)) ?? user?.role ?? "";
  const userRoleLabel = roleLabelMap[primaryVisibleRole] ?? "User";

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/50 transition-opacity duration-300 ease-in-out lg:hidden ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[var(--sidebar)] text-[var(--sidebar-text)] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-white p-1 text-[var(--accent)] shadow-[0_0_0_1px_rgba(255,255,255,0.24),0_10px_24px_rgba(0,0,0,0.22)]">
                {branding?.logo_url ? (
                  <img src={branding.logo_url} alt={branding.organization_name} className="h-full w-full rounded-full object-contain" />
                ) : (
                  <Building2 className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="headline-font text-base font-bold tracking-[-0.03em] text-white">{branding?.site_name ?? "CTRMS"}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sidebar-muted)]">
                  {branding?.organization_name ?? "Institution"}
                </p>
              </div>
            </div>
          </div>

          <nav className="no-scrollbar flex-1 overflow-y-auto px-2 pb-3">
            {grouped.map((section) => (
              <div key={section.group} className="mb-3">
                <p className="px-3 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--sidebar-muted)]">{section.group}</p>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `interactive-press flex items-center gap-2.5 rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-all ${
                          isActive
                            ? "bg-[var(--sidebar-active)] text-white shadow-sm"
                            : "text-[var(--sidebar-text)]/80 hover:bg-[var(--sidebar-hover)] hover:text-white"
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-auto border-t border-white/5 p-3">
            <div className="rounded-lg bg-white/6 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--sidebar-muted)]">User</p>
              <p className="mt-1.5 text-sm font-semibold text-white">{user?.full_name ?? "User"}</p>
              <p className="mt-0.5 text-[11px] text-[var(--sidebar-muted)]">
              {userRoleLabel}
              {user?.department ? ` · ${user.department}` : ""}
              </p>
              <button
                onClick={() => void onLogout()}
                className="interactive-press mt-2.5 w-full rounded-sm bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/14"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
