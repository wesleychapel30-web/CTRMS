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

const GROUP_ORDER = ["Core", "Finance & Reporting", "Records", "Administration"] as const;

export function Sidebar({ items, user, branding, onLogout, isOpen, onClose }: SidebarProps) {
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: items.filter((item) => (item.group ?? "Core") === group)
  })).filter((entry) => entry.items.length > 0);

  const roleLabelMap: Record<string, string> = {
    director: "Director",
    admin: "Administrator",
    staff: "Staff",
    finance_officer: "Finance Officer",
    auditor: "Auditor",
    it_admin: "IT Administrator",
  };
  const userRoleLabel = roleLabelMap[user?.role ?? ""] ?? "User";

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/45 transition-opacity lg:hidden ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[var(--sidebar)] text-[var(--sidebar-text)] shadow-2xl transition-transform lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="px-6 py-8">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-sm bg-[#2563eb] text-white">
                {branding?.logo_url ? (
                  <img src={branding.logo_url} alt={branding.organization_name} className="h-full w-full object-contain p-1" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="headline-font text-lg font-bold tracking-[-0.03em] text-white">{branding?.site_name ?? "CTRMS"}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sidebar-muted)]">
                  {branding?.organization_name ?? "Institution"}
                </p>
              </div>
            </div>
          </div>

          <nav className="no-scrollbar flex-1 overflow-y-auto px-2 pb-4">
            {grouped.map((section) => (
              <div key={section.group} className="mb-5">
                <p className="px-4 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sidebar-muted)]">{section.group}</p>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] transition-all ${
                          isActive
                            ? "border-l-4 border-[#3b82f6] bg-[var(--sidebar-active)] pl-3 text-white"
                            : "text-[var(--sidebar-text)]/90 hover:bg-[var(--sidebar-hover)] hover:text-white"
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

          <div className="mt-auto border-t border-white/5 p-4">
            <div className="rounded-lg bg-white/6 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sidebar-muted)]">User</p>
              <p className="mt-2 text-sm font-semibold text-white">{user?.full_name ?? "User"}</p>
              <p className="mt-0.5 text-[11px] text-[var(--sidebar-muted)]">
              {userRoleLabel}
              {user?.department ? ` · ${user.department}` : ""}
              </p>
              <button
                onClick={() => void onLogout()}
                className="mt-4 w-full rounded-sm bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/14"
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
