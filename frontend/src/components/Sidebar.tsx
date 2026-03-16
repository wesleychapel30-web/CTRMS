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
        className={`fixed inset-0 z-30 bg-slate-950/40 transition-opacity lg:hidden ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 transition-transform lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                {branding?.logo_url ? (
                  <img src={branding.logo_url} alt={branding.organization_name} className="h-full w-full object-contain p-1.5" />
                ) : (
                  <Building2 className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{branding?.site_name ?? "CTRMS"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{branding?.organization_name ?? "Institution"}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {grouped.map((section) => (
              <div key={section.group} className="mb-5">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{section.group}</p>
                <div className="mt-2 space-y-1">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                          isActive
                            ? "bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-900"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
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

          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.full_name ?? "User"}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {userRoleLabel}
              {user?.department ? ` · ${user.department}` : ""}
            </p>
            <button
              onClick={() => void onLogout()}
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
