import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { navItems } from "../config/navigation";
import { fetchGlobalSearch, fetchNotifications, fetchPublicBranding, markNotificationRead, resolveAssetUrl } from "../lib/api";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";
import type { BrandingSettings, NotificationItem, SessionUser, ThemeMode } from "../types";

type AppShellProps = {
  title: string;
  subtitle: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  user: SessionUser | null;
  onLogout: () => Promise<void>;
  children: ReactNode;
  rightPanel?: ReactNode;
};

export function AppShell({ title, subtitle, theme, onToggleTheme, user, onLogout, children, rightPanel }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ title: string; subtitle: string; href: string }>>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [branding, setBranding] = useState<BrandingSettings | null>(null);

  const permissionSet = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);
  const roleSet = useMemo(() => new Set([...(user?.roles ?? []), user?.role].filter(Boolean)), [user?.roles, user?.role]);

  const canGlobalSearch = permissionSet.has("search:global");
  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (item.href === "/activity" && !(roleSet.has("admin") || roleSet.has("director") || roleSet.has("super_admin"))) {
          return false;
        }
        if (!item.requires?.length) {
          return true;
        }
        return item.requires.some((key) => permissionSet.has(key));
      }),
    [permissionSet, roleSet]
  );

  useEffect(() => {
    setIsSidebarOpen(false);
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    fetchPublicBranding()
      .then((payload) => {
        setBranding(payload.branding);
        if (payload.branding.favicon_url) {
          let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = resolveAssetUrl(payload.branding.favicon_url);
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    fetchNotifications()
      .then((data) => setUnreadCount(data.unread_count ?? 0))
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!isNotificationsOpen) {
      return;
    }
    setIsNotificationsLoading(true);
    fetchNotifications()
      .then((data) => {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unread_count ?? 0);
        setNotificationError(null);
      })
      .catch((reason) => setNotificationError(reason instanceof Error ? reason.message : "Unable to load notifications"))
      .finally(() => setIsNotificationsLoading(false));
  }, [isNotificationsOpen]);

  useEffect(() => {
    if (!canGlobalSearch || !isSearchOpen) {
      setIsSearchLoading(false);
      return;
    }
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearchLoading(false);
      return;
    }

    const handle = window.setTimeout(() => {
      setIsSearchLoading(true);
      fetchGlobalSearch(trimmed)
        .then((data) => {
          setSearchResults((data.results ?? []).map((item) => ({ title: item.title, subtitle: item.subtitle, href: item.href })));
          setSearchError(null);
        })
        .catch((reason) => setSearchError(reason instanceof Error ? reason.message : "Search failed"))
        .finally(() => setIsSearchLoading(false));
    }, 220);

    return () => {
      window.clearTimeout(handle);
    };
  }, [canGlobalSearch, isSearchOpen, searchQuery]);

  const handleNotificationClick = (item: NotificationItem) => {
    setNotifications((current) => current.map((entry) => (entry.id === item.id ? { ...entry, is_read: true } : entry)));
    void markNotificationRead(item.id).then((response) => setUnreadCount(response.unread_count)).catch(() => null);
    setIsNotificationsOpen(false);
    if (item.href) {
      navigate(item.href);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <Sidebar
        items={visibleNavItems}
        user={user}
        branding={branding}
        onLogout={onLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="lg:pl-64">
        <TopHeader
          title={title}
          subtitle={subtitle}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          user={user}
          canGlobalSearch={canGlobalSearch}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isSearchOpen={isSearchOpen}
          onSearchOpen={() => setIsSearchOpen(true)}
          onSearchClose={() => setIsSearchOpen(false)}
          searchResults={searchResults}
          searchError={searchError}
          isSearchLoading={isSearchLoading}
          onSearchSelect={(href) => {
            setIsSearchOpen(false);
            setSearchQuery("");
            setSearchResults([]);
            navigate(href);
          }}
          notificationsOpen={isNotificationsOpen}
          onToggleNotifications={() => setIsNotificationsOpen((current) => !current)}
          onCloseNotifications={() => setIsNotificationsOpen(false)}
          notifications={notifications}
          isNotificationsLoading={isNotificationsLoading}
          unreadCount={unreadCount}
          notificationError={notificationError}
          onNotificationClick={handleNotificationClick}
        />

        <main className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 md:px-8 lg:px-10">
          {rightPanel ? (
            <div key={location.pathname} className="page-enter grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
              <div>{children}</div>
              <aside className="surface-panel sticky top-[4.5rem] h-[calc(100vh-5.5rem)] overflow-y-auto rounded-xl p-4">
                {rightPanel}
              </aside>
            </div>
          ) : (
            <div key={location.pathname} className="page-enter">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
