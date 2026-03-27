import { Bell, LoaderCircle, Menu, MoonStar, Plus, Search, SunMedium } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "./PageHeader";
import { NotificationDropdown } from "./NotificationDropdown";
import { InlineBanner } from "./FeedbackStates";
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
  isSearchLoading: boolean;
  onSearchSelect: (href: string) => void;
  canCreateRequest: boolean;
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  notifications: NotificationItem[];
  isNotificationsLoading: boolean;
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
  isSearchLoading,
  onSearchSelect,
  canCreateRequest,
  notificationsOpen,
  onToggleNotifications,
  onCloseNotifications,
  notifications,
  isNotificationsLoading,
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
    <header className="sticky top-0 z-30 bg-[var(--surface)]/85 px-4 py-4 backdrop-blur-md sm:px-8">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <button
            onClick={onOpenSidebar}
            className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-sm bg-[var(--surface-card)] text-[var(--ink)] hover:bg-[var(--surface-low)] lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <PageHeader title={title} subtitle={subtitle} />
        </div>

        <div className="flex items-center gap-2">
          {canGlobalSearch ? (
            <div className="relative hidden md:block">
              <label className="flex items-center gap-2 rounded-md bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--muted)] shadow-sm">
                <Search className="h-4 w-4 text-[var(--muted)]" />
                <input
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                  onFocus={onSearchOpen}
                  placeholder="Search institutional data..."
                  className="w-64 bg-transparent outline-none placeholder:text-[var(--muted)]"
                />
              </label>
              {isSearchOpen ? (
                <div className="surface-panel dropdown-enter absolute right-0 top-12 z-40 w-96 overflow-hidden rounded-xl">
                  <div className="max-h-80 overflow-y-auto p-2">
                    {searchError ? <InlineBanner variant="error" title="Search unavailable" message={searchError} className="m-1" /> : null}
                    {!searchError && !searchQuery.trim() ? (
                      <p className="px-3 py-3 text-sm text-[var(--muted)]">Start typing to search requests, invitations, and records.</p>
                    ) : null}
                    {!searchError && isSearchLoading ? (
                      <div className="space-y-2 p-1" aria-busy="true">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div key={`search-skeleton-${index}`} className="rounded-lg bg-[var(--surface-card)] px-3 py-3">
                            <div className="space-y-2">
                              <div className="feedback-skeleton h-3 w-2/3 rounded-full" />
                              <div className="feedback-skeleton h-2.5 w-full rounded-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {!searchError && !isSearchLoading && searchResults.length ? (
                      <div className="space-y-1">
                        {searchResults.slice(0, 8).map((item) => (
                          <button
                            key={item.href}
                            type="button"
                            onClick={() => onSearchSelect(item.href)}
                            className="w-full rounded-lg bg-[var(--surface-card)] px-3 py-2 text-left transition hover:-translate-y-[1px] hover:bg-[var(--surface-low)]"
                          >
                            <p className="text-sm font-semibold text-[var(--ink)]">{item.title}</p>
                            <p className="text-xs text-[var(--muted)]">{item.subtitle}</p>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {!searchError && !isSearchLoading && searchQuery.trim() && !searchResults.length ? (
                      <p className="px-3 py-3 text-sm text-[var(--muted)]">No matching records found.</p>
                    ) : null}
                  </div>
                  <div className="bg-[var(--surface-low)] px-3 py-2 text-right">
                    <button onClick={onSearchClose} className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
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
              className="primary-button hidden items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-sm hover:opacity-95 sm:inline-flex"
            >
              <Plus className="h-4 w-4" />
              Create Request
            </Link>
          ) : null}

          <button
            onClick={onToggleTheme}
            className="interactive-press inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--surface-card)] text-[var(--muted)] hover:bg-[var(--surface-low)]"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
          </button>

          <div ref={notificationRef} className="relative">
            <button
              onClick={onToggleNotifications}
              className={`interactive-press relative inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--surface-card)] text-[var(--muted)] hover:bg-[var(--surface-low)] ${
                unreadCount > 0 ? "status-pulse" : ""
              }`}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
              ) : null}
              {isNotificationsLoading ? <LoaderCircle className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin text-[var(--accent)]" /> : null}
            </button>
            <NotificationDropdown
              isOpen={notificationsOpen}
              isLoading={isNotificationsLoading}
              notifications={notifications}
              unreadCount={unreadCount}
              error={notificationError}
              onClose={onCloseNotifications}
              onItemClick={onNotificationClick}
            />
          </div>

          <div className="inline-flex items-center gap-3 pl-3">
            <div className="hidden h-8 w-px bg-[var(--line)] sm:block" />
            <span className="grid h-8 w-8 place-items-center rounded-sm bg-[var(--surface-container)] text-xs font-semibold text-[var(--ink)]">
              {initials}
            </span>
            <span className="hidden text-sm font-semibold text-[var(--ink)] sm:block">{user?.full_name ?? "User"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
