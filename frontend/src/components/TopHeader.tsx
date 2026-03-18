import { Bell, Menu, MoonStar, Plus, Search, SunMedium } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "./PageHeader";
import { NotificationDropdown } from "./NotificationDropdown";
import type { NotificationItem, SessionUser, ThemeMode } from "../types";

type SearchResult = {
  title: string;
  subtitle: string;
  href: string;
};

type TopHeaderProps = {
  title: string;
  subtitle?: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenSidebar: () => void;
  user: SessionUser | null;
  canGlobalSearch: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isSearchOpen: boolean;
  onSearchOpen: () => void;
  onSearchClose: () => void;
  searchResults: SearchResult[];
  searchError: string | null;
  onSearchSelect: (href: string) => void;
  canCreateRequest: boolean;
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  notifications: NotificationItem[];
  unreadCount: number;
  notificationError: string | null;
  onNotificationClick: (item: NotificationItem) => void;
};

export function TopHeader({
  title,
  subtitle,
  theme,
  onToggleTheme,
  onOpenSidebar,
  user,
  canGlobalSearch,
  searchQuery,
  onSearchChange,
  isSearchOpen,
  onSearchOpen,
  onSearchClose,
  searchResults,
  searchError,
  onSearchSelect,
  canCreateRequest,
  notificationsOpen,
  onToggleNotifications,
  onCloseNotifications,
  notifications,
  unreadCount,
  notificationError,
  onNotificationClick
}: TopHeaderProps) {
  const initials = (user?.full_name ?? "User")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const notificationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || !notificationRef.current?.contains(target)) {
        onCloseNotifications();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseNotifications();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [notificationsOpen, onCloseNotifications]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <button
            onClick={onOpenSidebar}
            className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <PageHeader title={title} subtitle={subtitle} />
        </div>

        <div className="flex items-center gap-2">
          {canGlobalSearch ? (
            <div className="relative hidden md:block">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Search className="h-4 w-4" />
                <input
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                  onFocus={onSearchOpen}
                  placeholder="Search"
                  className="w-56 bg-transparent outline-none"
                />
              </label>
              {isSearchOpen ? (
                <div className="absolute right-0 top-11 z-40 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
                  <div className="max-h-80 overflow-y-auto p-2">
                    {searchError ? <p className="px-2 py-2 text-sm text-rose-600">{searchError}</p> : null}
                    {searchResults.length ? (
                      <div className="space-y-1">
                        {searchResults.slice(0, 8).map((item) => (
                          <button
                            key={item.href}
                            type="button"
                            onClick={() => onSearchSelect(item.href)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                          >
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="px-2 py-2 text-sm text-slate-500 dark:text-slate-400">No results.</p>
                    )}
                  </div>
                  <div className="border-t border-slate-200 px-3 py-2 text-right dark:border-slate-800">
                    <button onClick={onSearchClose} className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {canCreateRequest ? (
            <Link
              to="/requests/new"
              className="hidden items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-900 dark:hover:bg-cyan-400 sm:inline-flex"
            >
              <Plus className="h-4 w-4" />
              Create Request
            </Link>
          ) : null}

          <button
            onClick={onToggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
          </button>

          <div ref={notificationRef} className="relative">
            <button
              onClick={onToggleNotifications}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
              ) : null}
            </button>
            <NotificationDropdown
              isOpen={notificationsOpen}
              notifications={notifications}
              unreadCount={unreadCount}
              error={notificationError}
              onClose={onCloseNotifications}
              onItemClick={onNotificationClick}
            />
          </div>

          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-cyan-500 dark:text-slate-900">
              {initials}
            </span>
            <span className="hidden text-sm font-medium text-slate-900 dark:text-slate-100 sm:block">{user?.full_name ?? "User"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
