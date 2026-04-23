import { useState, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { StatePanel } from "./components/FeedbackStates";
import { useSession } from "./context/SessionContext";
import { ActivityPage } from "./pages/ActivityPage";
import { AdminPage } from "./pages/AdminPage";
import { ApprovalInboxPage } from "./pages/ApprovalInboxPage";
import { CalendarPage } from "./pages/CalendarPage";
import { CreateRequestPage } from "./pages/CreateRequestPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { FinancePage } from "./pages/FinancePage";
import { InvitationDetailsPage } from "./pages/InvitationDetailsPage";
import { InvitationsPage } from "./pages/InvitationsPage";
import { InventoryPage } from "./pages/InventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { OrganizationPage } from "./pages/OrganizationPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { ProcurementPage } from "./pages/ProcurementPage";
import { ReportsPage } from "./pages/ReportsPage";
import { RequestDetailsPage } from "./pages/RequestDetailsPage";
import { RequestsPage } from "./pages/RequestsPage";
import { SettingsPage } from "./pages/SettingsPage";
import type { ThemeMode } from "./types";

const ROUTE_PERMISSIONS = {
  dashboard: ["dashboard:view"],
  organization: ["user:manage", "rbac:manage", "settings:update"],
  approvals: ["procurement:approve", "payment_request:approve", "invoice:approve"],
  procurement: ["procurement:view_all", "procurement:create", "purchase_order:view_all"],
  inventory: ["inventory:view", "goods_receipt:view", "goods_receipt:record"],
  finance: ["finance:view", "payment:view", "payment:record"],
  requests: ["request:view_all", "request:view_own", "payment:view", "payment:record"],
  createRequest: ["request:create"],
  requestDetails: ["request:view_all", "request:view_own", "payment:view", "payment:record"],
  invitations: ["invitation:view_all", "invitation:view_own"],
  invitationDetails: ["invitation:view_all", "invitation:view_own"],
  calendar: ["invitation:view_all", "invitation:view_own"],
  reports: ["report:view"],
  admin: ["user:manage", "rbac:manage"],
  payments: ["payment:view", "payment:record"],
  documents: ["document:view_all", "document:view_own"],
  activity: ["audit:view"],
  settings: ["settings:update", "profile:change_password"]
} as const;

function getPageMeta(pathname: string) {
  if (pathname.startsWith("/requests/") && pathname !== "/requests/new") {
    return {
      title: "Request Details",
      subtitle: "Applicant information, attachments, and status."
    };
  }
  if (pathname.startsWith("/invitations/") && pathname !== "/invitations") {
    return {
      title: "Invitation Details",
      subtitle: "Event information, attachments, and status."
    };
  }

  const pageMeta: Record<string, { title: string; subtitle: string }> = {
    "/": {
      title: "Dashboard",
      subtitle: "Overview of requests, procurement, finance, and inventory."
    },
    "/organization": {
      title: "Organization",
      subtitle: "Organizations, departments, branches, and workflows."
    },
    "/approvals": {
      title: "Approval Inbox",
      subtitle: "Pending procurement and finance decisions."
    },
    "/procurement": {
      title: "Procurement",
      subtitle: "Requests, purchase orders, and delivery."
    },
    "/inventory": {
      title: "Inventory",
      subtitle: "Receiving, stock, and ledger records."
    },
    "/finance": {
      title: "Finance",
      subtitle: "Invoices, payment requests, and payments."
    },
    "/requests": {
      title: "Requests",
      subtitle: "Request list and status."
    },
    "/requests/new": {
      title: "Create Request",
      subtitle: "Enter request details."
    },
    "/invitations": {
      title: "Invitations",
      subtitle: "Invitation list and responses."
    },
    "/calendar": {
      title: "Calendar",
      subtitle: "Monthly schedule and upcoming events."
    },
    "/reports": {
      title: "Reports",
      subtitle: "Reporting and exports."
    },
    "/admin": {
      title: "Administration Panel",
      subtitle: "Manage users, roles, and permissions."
    },
    "/payments": {
      title: "Payments",
      subtitle: "Approved requests and disbursements."
    },
    "/documents": {
      title: "Documents",
      subtitle: "Central document library."
    },
    "/activity": {
      title: "Activity Logs",
      subtitle: "System audit trail."
    },
    "/settings": {
      title: "System Settings",
      subtitle: "Branding, email, notifications, and access."
    }
  };

  return pageMeta[pathname] ?? pageMeta["/"];
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const location = useLocation();
  const { user, isLoading, logout } = useSession();

  if (location.pathname === "/login") {
    return <LoginPage />;
  }

  if (isLoading) {
    return (
      <div data-theme={theme} className="min-h-screen bg-[var(--surface)] px-6 py-10">
        <div className="mx-auto max-w-xl">
          <StatePanel
            variant="loading"
            title="Loading session"
            message="Restoring your session."
          />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.force_password_change && location.pathname !== "/settings") {
    return <Navigate to="/settings" replace />;
  }

  const permissionSet = new Set(user.permissions ?? []);
  const roleSet = new Set([...(user.roles ?? []), user.role].filter(Boolean));
  const canAccessAuditByRole = roleSet.has("admin") || roleSet.has("director") || roleSet.has("super_admin");
  const canAccess = (requiredPermissions: readonly string[]) => requiredPermissions.some((key) => permissionSet.has(key));

  const canViewDashboard = canAccess(ROUTE_PERMISSIONS.dashboard);
  const canViewOrganization = canAccess(ROUTE_PERMISSIONS.organization);
  const canViewApprovals = canAccess(ROUTE_PERMISSIONS.approvals);
  const canViewProcurement = canAccess(ROUTE_PERMISSIONS.procurement);
  const canViewInventory = canAccess(ROUTE_PERMISSIONS.inventory);
  const canViewFinance = canAccess(ROUTE_PERMISSIONS.finance);
  const canViewRequests = canAccess(ROUTE_PERMISSIONS.requests);
  const canCreateRequest = canAccess(ROUTE_PERMISSIONS.createRequest);
  const canViewRequestDetails = canAccess(ROUTE_PERMISSIONS.requestDetails);
  const canViewInvitations = canAccess(ROUTE_PERMISSIONS.invitations);
  const canViewInvitationDetails = canAccess(ROUTE_PERMISSIONS.invitationDetails);
  const canViewCalendar = canAccess(ROUTE_PERMISSIONS.calendar);
  const canViewReports = canAccess(ROUTE_PERMISSIONS.reports);
  const canViewAdmin = canAccess(ROUTE_PERMISSIONS.admin);
  const canViewPayments = canAccess(ROUTE_PERMISSIONS.payments);
  const canViewDocuments = canAccess(ROUTE_PERMISSIONS.documents);
  const canViewActivity = canAccess(ROUTE_PERMISSIONS.activity) && canAccessAuditByRole;
  const canViewSettings = canAccess(ROUTE_PERMISSIONS.settings);

  const fallbackRoute =
    (canViewDashboard && "/") ||
    (canViewOrganization && "/organization") ||
    (canViewApprovals && "/approvals") ||
    (canViewProcurement && "/procurement") ||
    (canViewInventory && "/inventory") ||
    (canViewFinance && "/finance") ||
    (canViewRequests && "/requests") ||
    (canViewInvitations && "/invitations") ||
    (canViewCalendar && "/calendar") ||
    (canViewPayments && "/payments") ||
    (canViewReports && "/reports") ||
    (canViewDocuments && "/documents") ||
    (canViewAdmin && "/admin") ||
    (canViewActivity && "/activity") ||
    (canViewSettings && "/settings") ||
    "/login";

  const guard = (allowed: boolean, element: ReactElement) => (allowed ? element : <Navigate to={fallbackRoute} replace />);

  const meta = getPageMeta(location.pathname);

  return (
    <div data-theme={theme} className="min-h-screen text-slate-950 dark:text-slate-100">
      <AppShell
        title={meta.title}
        subtitle={meta.subtitle}
        theme={theme}
        user={user}
        onLogout={logout}
        onToggleTheme={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      >
        <Routes>
          <Route path="/" element={guard(canViewDashboard, <DashboardPage />)} />
          <Route path="/organization" element={guard(canViewOrganization, <OrganizationPage />)} />
          <Route path="/approvals" element={guard(canViewApprovals, <ApprovalInboxPage />)} />
          <Route path="/procurement" element={guard(canViewProcurement, <ProcurementPage />)} />
          <Route path="/inventory" element={guard(canViewInventory, <InventoryPage />)} />
          <Route path="/finance" element={guard(canViewFinance, <FinancePage />)} />
          <Route path="/requests" element={guard(canViewRequests, <RequestsPage />)} />
          <Route path="/requests/new" element={guard(canCreateRequest, <CreateRequestPage />)} />
          <Route path="/requests/:requestId" element={guard(canViewRequestDetails, <RequestDetailsPage />)} />
          <Route path="/invitations" element={guard(canViewInvitations, <InvitationsPage />)} />
          <Route path="/invitations/:invitationId" element={guard(canViewInvitationDetails, <InvitationDetailsPage />)} />
          <Route path="/calendar" element={guard(canViewCalendar, <CalendarPage />)} />
          <Route path="/reports" element={guard(canViewReports, <ReportsPage />)} />
          <Route path="/admin" element={guard(canViewAdmin, <AdminPage />)} />
          <Route path="/payments" element={guard(canViewPayments, <PaymentsPage />)} />
          <Route path="/documents" element={guard(canViewDocuments, <DocumentsPage />)} />
          <Route path="/activity" element={guard(canViewActivity, <ActivityPage />)} />
          <Route path="/settings" element={guard(canViewSettings, <SettingsPage />)} />
          <Route path="*" element={<Navigate to={fallbackRoute} replace />} />
        </Routes>
      </AppShell>
    </div>
  );
}

export default App;
