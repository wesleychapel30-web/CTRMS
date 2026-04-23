import type {
  ActivityLogRecord,
  ApprovalInbox,
  AdminOverview,
  ApiListResponse,
  BrandingSettings,
  DashboardOverview,
  DocumentRecord,
  EnterpriseOverview,
  FinanceWorkspace,
  InvitationRecord,
  InventoryWorkspace,
  OrganizationWorkspace,
  ProcurementWorkspace,
  NotificationItem,
  SearchResult,
  RequestRecord,
  RequestReportSummary,
  SessionUser,
  SettingsOverview
} from "../types";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function isAuthError(error: unknown) {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

function collectApiMessages(value: unknown, fieldName?: string): string[] {
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    return [fieldName ? `${fieldName}: ${value}` : value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectApiMessages(item, fieldName));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) =>
      collectApiMessages(nestedValue, key === "non_field_errors" ? undefined : key)
    );
  }
  return [];
}

function getApiErrorMessage(data: unknown, status: number) {
  const directMessage =
    data && typeof data === "object"
      ? (data as { error?: unknown; detail?: unknown; message?: unknown }).error ??
        (data as { error?: unknown; detail?: unknown; message?: unknown }).detail ??
        (data as { error?: unknown; detail?: unknown; message?: unknown }).message
      : data;

  if (typeof directMessage === "string" && directMessage.trim()) {
    return directMessage;
  }

  const messages = collectApiMessages(data).filter(Boolean);
  if (messages.length) {
    return messages.slice(0, 3).join(" ");
  }

  if (status >= 500) {
    return "Server error. Please check the backend logs.";
  }

  return "Request failed";
}

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() ?? "";
  }
  return "";
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const hasBody = init.body !== undefined && !(init.body instanceof FormData);

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (init.method && !["GET", "HEAD", "OPTIONS"].includes(init.method.toUpperCase())) {
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers
  });

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const message = getApiErrorMessage(data, response.status);
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export function buildApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  return `${base}${normalizedPath}`;
}

function getDownloadFilename(response: Response, fallbackFilename: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1].trim());
  }
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1]?.trim() || fallbackFilename;
}

export async function downloadApiFile(path: string, fallbackFilename: string) {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json") ? await response.json() : await response.text();
    throw new ApiError(getApiErrorMessage(data, response.status), response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getDownloadFilename(response, fallbackFilename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return link.download;
}

export function resolveAssetUrl(path?: string | null) {
  if (!path) {
    return "";
  }
  return buildApiUrl(path);
}

export function buildAttachmentPreviewUrl(downloadPath?: string | null, fallbackPath?: string | null) {
  const resolvedDownloadPath = resolveAssetUrl(downloadPath);
  if (resolvedDownloadPath) {
    const url = new URL(resolvedDownloadPath, window.location.origin);
    url.searchParams.set("disposition", "inline");
    return url.toString();
  }
  return resolveAssetUrl(fallbackPath);
}

export async function fetchSession() {
  return apiFetch<{ authenticated: boolean; user: SessionUser | null }>("/api/session/");
}

export async function loginWithSession(username: string, password: string) {
  return apiFetch<{ success: boolean; user: SessionUser }>("/api/session/login/", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export async function logoutSession() {
  return apiFetch<{ success: boolean }>("/api/session/logout/", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function changeOwnPassword(payload: { current_password: string; new_password: string }) {
  return apiFetch<{ success: boolean; user: SessionUser }>("/api/session/change-password/", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchDashboardOverview() {
  return apiFetch<{ success: boolean } & DashboardOverview>("/api/dashboard-overview/");
}

export async function fetchRequests(params?: URLSearchParams) {
  const suffix = params?.toString() ? `?${params.toString()}` : "";
  return apiFetch<ApiListResponse<RequestRecord>>(`/api/requests/${suffix}`);
}

export async function fetchRequest(id: string) {
  return apiFetch<RequestRecord>(`/api/requests/${id}/`);
}

export async function createRequest(payload: Partial<RequestRecord>) {
  return apiFetch<RequestRecord>("/api/requests/", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function submitDraftRequest(requestId: string) {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/submit_request/`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function startRequestReview(requestId: string, comment = "") {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/start_review/`, {
    method: "POST",
    body: JSON.stringify({ comment })
  });
}

export async function suggestRequestCategory(text: string) {
  return apiFetch<{ category: string; category_display: string }>(`/api/requests/suggest_category/`, {
    method: "POST",
    body: JSON.stringify({ text })
  });
}

export async function uploadRequestDocument(requestId: string, file: File, documentType: string) {
  const formData = new FormData();
  formData.append("document", file);
  formData.append("document_type", documentType);
  return apiFetch(`/api/requests/${requestId}/upload_document/`, {
    method: "POST",
    body: formData
  });
}

export async function approveRequest(requestId: string, approvedAmount: number, reviewNotes: string) {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/approve_request/`, {
    method: "POST",
    body: JSON.stringify({ approved_amount: approvedAmount, review_notes: reviewNotes })
  });
}

export async function rejectRequest(requestId: string, reviewNotes: string) {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/reject_request/`, {
    method: "POST",
    body: JSON.stringify({ review_notes: reviewNotes })
  });
}

export async function markRequestPaid(
  requestId: string,
  paymentMethod: string,
  paymentReference: string,
  disbursedAmount?: number
) {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/mark_as_paid/`, {
    method: "POST",
    body: JSON.stringify({
      payment_date: new Date().toISOString(),
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      disbursed_amount: disbursedAmount
    })
  });
}

export async function addRequestPayment(
  requestId: string,
  paymentMethod: string,
  paymentReference: string,
  paymentAmount: number
) {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/add_payment/`, {
    method: "POST",
    body: JSON.stringify({
      payment_date: new Date().toISOString(),
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      payment_amount: paymentAmount
    })
  });
}

export async function completeRequestPayment(
  requestId: string,
  paymentMethod: string,
  paymentReference: string,
  finalDisbursedAmount?: number
) {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/mark_payment_completed/`, {
    method: "POST",
    body: JSON.stringify({
      payment_date: new Date().toISOString(),
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      final_disbursed_amount: finalDisbursedAmount
    })
  });
}

export async function cancelRequest(requestId: string, comment: string) {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/cancel/`, {
    method: "POST",
    body: JSON.stringify({ comment })
  });
}

export async function restoreRequest(requestId: string, comment: string) {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/restore/`, {
    method: "POST",
    body: JSON.stringify({ comment })
  });
}

export async function reverseRequest(requestId: string, comment: string) {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/reverse/`, {
    method: "POST",
    body: JSON.stringify({ comment })
  });
}

export async function addRequestTimelineEntry(requestId: string, payload: { mode: "comment" | "internal_note"; body: string }) {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/timeline_entries/`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function requestClarification(requestId: string, reviewNotes: string) {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/request_clarification/`, {
    method: "POST",
    body: JSON.stringify({ review_notes: reviewNotes })
  });
}

export async function financeStartProcessing(requestId: string, financeNotes = "") {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/finance_start_processing/`, {
    method: "POST",
    body: JSON.stringify({ finance_notes: financeNotes })
  });
}

export async function financeRaiseQuery(requestId: string, financeNotes: string) {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/finance_raise_query/`, {
    method: "POST",
    body: JSON.stringify({ finance_notes: financeNotes })
  });
}

export async function financeMarkPendingPayment(requestId: string, financeNotes = "", approvedAmount?: number) {
  return apiFetch<RequestRecord>(`/api/requests/${requestId}/finance_mark_pending_payment/`, {
    method: "POST",
    body: JSON.stringify({
      finance_notes: financeNotes,
      ...(approvedAmount !== undefined ? { approved_amount: approvedAmount } : {})
    })
  });
}

export async function fetchRequestReport(params?: URLSearchParams) {
  const suffix = params?.toString() ? `?${params.toString()}` : "";
  return apiFetch<RequestReportSummary>(`/api/requests/report/${suffix}`);
}

export async function fetchInvitations(params?: URLSearchParams) {
  const suffix = params?.toString() ? `?${params.toString()}` : "";
  return apiFetch<ApiListResponse<InvitationRecord>>(`/api/invitations/${suffix}`);
}

export async function fetchInvitation(id: string) {
  return apiFetch<InvitationRecord>(`/api/invitations/${id}/`);
}

export async function createInvitation(payload: Partial<InvitationRecord>) {
  return apiFetch<InvitationRecord>("/api/invitations/", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function acceptInvitation(id: string, notes: string) {
  return apiFetch<InvitationRecord>(`/api/invitations/${id}/accept_invitation/`, {
    method: "POST",
    body: JSON.stringify({ notes })
  });
}

export async function declineInvitation(id: string, reason: string) {
  return apiFetch<InvitationRecord>(`/api/invitations/${id}/decline_invitation/`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

export async function confirmInvitationAttendance(id: string) {
  return apiFetch<InvitationRecord>(`/api/invitations/${id}/confirm_attendance/`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function revertInvitationDecision(id: string, reason: string) {
  return apiFetch<InvitationRecord>(`/api/invitations/${id}/revert_decision/`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

export async function addInvitationTimelineEntry(id: string, payload: { mode: "comment" | "internal_note"; body: string }) {
  return apiFetch<InvitationRecord>(`/api/invitations/${id}/timeline_entries/`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function uploadInvitationAttachment(id: string, file: File, attachmentType: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("attachment_type", attachmentType);
  return apiFetch(`/api/invitations/${id}/upload_attachment/`, {
    method: "POST",
    body: formData
  });
}

export async function fetchInvitationCalendar() {
  return apiFetch<InvitationRecord[]>("/api/invitations/calendar/");
}

export async function fetchInvitationCalendarMonth(year: number, month: number) {
  const params = new URLSearchParams();
  params.set("year", String(year));
  params.set("month", String(month));
  return apiFetch<InvitationRecord[]>(`/api/invitations/calendar/?${params.toString()}`);
}

export async function fetchUpcomingInvitations() {
  return apiFetch<InvitationRecord[]>("/api/invitations/upcoming/");
}

export async function sendInvitationReminders(type: "both" | "3_days" | "1_day" = "both") {
  return apiFetch<{ message: string; "3_day_reminders": number; "1_day_reminders": number }>(
    "/api/invitations/send_reminders/",
    {
      method: "POST",
      body: JSON.stringify({ type })
    }
  );
}

export async function fetchDocuments() {
  return apiFetch<{ success: boolean; documents: DocumentRecord[] }>("/api/documents-data/");
}

export async function fetchActivityLogs() {
  return apiFetch<{ success: boolean; logs: ActivityLogRecord[] }>("/api/activity-logs-data/");
}

export async function fetchNotifications() {
  return apiFetch<{ success: boolean; notifications: NotificationItem[]; unread_count: number }>("/api/notifications-data/");
}

export async function markNotificationRead(receiptId: string) {
  return apiFetch<{ success: boolean; unread_count: number }>(`/api/notifications/${receiptId}/read/`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function fetchGlobalSearch(query: string) {
  const params = new URLSearchParams();
  params.set("q", query);
  return apiFetch<{ success: boolean; results: SearchResult[] }>(`/api/search/?${params.toString()}`);
}

export async function fetchUserManagement() {
  return apiFetch<{ success: boolean } & AdminOverview>("/api/user-management-data/");
}

export async function createUser(payload: {
  username: string;
  email: string;
  full_name: string;
  role: string;
  department: string;
  password: string;
  additional_roles?: string[];
  force_password_change?: boolean;
}) {
  return apiFetch<{ success: boolean; user: SessionUser }>("/api/users/", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateUser(
  userId: string,
  payload: Partial<{
    email: string;
    full_name: string;
    role: string;
    additional_roles: string[];
    department: string;
    is_active: boolean;
    is_active_staff: boolean;
    is_archived: boolean;
    force_password_change: boolean;
    password: string;
  }>
) {
  return apiFetch<{ success: boolean; user: SessionUser }>(`/api/users/${userId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deactivateUser(userId: string) {
  return apiFetch<{ success: boolean; user: SessionUser; message?: string }>(`/api/users/${userId}/deactivate/`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function reactivateUser(userId: string) {
  return apiFetch<{ success: boolean; user: SessionUser; message?: string }>(`/api/users/${userId}/reactivate/`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function resetUserPassword(
  userId: string,
  payload: {
    new_password: string;
    force_password_change?: boolean;
  }
) {
  return apiFetch<{ success: boolean; user: SessionUser }>(`/api/users/${userId}/reset-password/`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export type RbacOverview = {
  success: boolean;
  roles: Array<{ key: string; name: string; description: string }>;
  permissions: Array<{ key: string; name: string; description: string; module: string }>;
  mapping: Record<string, string[]>;
  policy_bound_permissions: Record<string, { allowed_roles: string[]; reason: string }>;
};

export async function fetchRbacOverview() {
  return apiFetch<RbacOverview>("/api/rbac/");
}

export async function updateRolePermissions(roleKey: string, permissionKeys: string[]) {
  return apiFetch<{ success: boolean; role_key: string; permission_keys: string[] }>(`/api/rbac/roles/${roleKey}/`, {
    method: "PUT",
    body: JSON.stringify({ permission_keys: permissionKeys })
  });
}

export async function fetchSystemSettings() {
  return apiFetch<{ success: boolean } & SettingsOverview>("/api/system-settings-data/");
}

export async function fetchPublicBranding() {
  return apiFetch<{ success: boolean; branding: BrandingSettings }>("/api/public-branding/");
}

export async function updateSystemSettings(payload: Partial<SettingsOverview>) {
  return apiFetch<{ success: boolean } & SettingsOverview>("/api/system-settings-data/", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function sendTestEmail(recipientEmail: string) {
  return apiFetch<{ success: boolean; message: string }>("/api/system-settings-test-email/", {
    method: "POST",
    body: JSON.stringify({ recipient_email: recipientEmail })
  });
}

export async function uploadOrganizationAssets(files: { logo?: File; favicon?: File; bannerImage?: File }) {
  const formData = new FormData();
  if (files.logo) {
    formData.append("logo", files.logo);
  }
  if (files.favicon) {
    formData.append("favicon", files.favicon);
  }
  if (files.bannerImage) {
    formData.append("banner_image", files.bannerImage);
  }
  return apiFetch<{ success: boolean; organization_settings: { logo_url: string; favicon_url: string; banner_url: string } }>(
    "/api/system-settings-assets/",
    {
      method: "POST",
      body: formData
    }
  );
}

export async function fetchEnterpriseOverview() {
  return apiFetch<{ success: boolean } & EnterpriseOverview>("/api/enterprise/overview/");
}

export async function fetchProcurementWorkspace() {
  return apiFetch<{ success: boolean } & ProcurementWorkspace>("/api/enterprise/procurement/");
}

export async function fetchInventoryWorkspace() {
  return apiFetch<{ success: boolean } & InventoryWorkspace>("/api/enterprise/inventory/");
}

export async function fetchFinanceWorkspace() {
  return apiFetch<{ success: boolean } & FinanceWorkspace>("/api/enterprise/finance/");
}

export async function fetchOrganizationWorkspace() {
  return apiFetch<{ success: boolean } & OrganizationWorkspace>("/api/enterprise/organization/");
}

export async function updateOrganization(payload: { name?: string; legal_name?: string; timezone?: string; currency_code?: string }) {
  return apiFetch<{ success: boolean; organization: OrganizationWorkspace["organization"] }>("/api/enterprise/organization/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createDepartment(payload: { name: string; code?: string; description?: string }) {
  return apiFetch<{ success: boolean; department: OrganizationWorkspace["departments"][number] }>("/api/enterprise/departments/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDepartment(deptId: string, payload: { name?: string; code?: string; description?: string; is_active?: boolean }) {
  return apiFetch<{ success: boolean; department: OrganizationWorkspace["departments"][number] }>(`/api/enterprise/departments/${deptId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteDepartment(deptId: string) {
  return apiFetch<{ success: boolean }>(`/api/enterprise/departments/${deptId}/`, { method: "DELETE" });
}

export async function createBranch(payload: { name: string; code?: string; city?: string; country?: string; address?: string }) {
  return apiFetch<{ success: boolean; branch: OrganizationWorkspace["branches"][number] }>("/api/enterprise/branches/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBranch(branchId: string, payload: { name?: string; code?: string; city?: string; country?: string; address?: string; is_active?: boolean }) {
  return apiFetch<{ success: boolean; branch: OrganizationWorkspace["branches"][number] }>(`/api/enterprise/branches/${branchId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteBranch(branchId: string) {
  return apiFetch<{ success: boolean }>(`/api/enterprise/branches/${branchId}/`, { method: "DELETE" });
}

export async function fetchApprovalInbox(params?: URLSearchParams) {
  const suffix = params?.toString() ? `?${params.toString()}` : "";
  return apiFetch<{ success: boolean } & ApprovalInbox>(`/api/enterprise/approvals/inbox/${suffix}`);
}

export async function createProcurementRequest(payload: {
  title: string;
  justification?: string;
  needed_by_date?: string | null;
  department: string;
  budget_account?: string | null;
  lines: Array<{
    product?: string | null;
    description: string;
    unit_of_measure?: string;
    quantity: number;
    unit_price: number;
  }>;
}) {
  return apiFetch<{ success: boolean; request: ProcurementWorkspace["requests"][number] }>("/api/enterprise/procurement/requests/", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateProcurementRequest(
  requestId: string,
  payload: {
    title: string;
    justification?: string;
    needed_by_date?: string | null;
    department: string;
    budget_account?: string | null;
    lines: Array<{
      product?: string | null;
      description: string;
      unit_of_measure?: string;
      quantity: number;
      unit_price: number;
    }>;
  }
) {
  return apiFetch<{ success: boolean; request: ProcurementWorkspace["requests"][number] }>(`/api/enterprise/procurement/requests/${requestId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function submitProcurementRequest(requestId: string) {
  return apiFetch<{ success: boolean; request: ProcurementWorkspace["requests"][number]; message?: string }>(
    `/api/enterprise/procurement/requests/${requestId}/submit/`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function approveEnterpriseProcurementRequest(requestId: string, comments = "") {
  return apiFetch<{ success: boolean; request: ProcurementWorkspace["requests"][number]; message?: string }>(
    `/api/enterprise/procurement/requests/${requestId}/approve/`,
    {
      method: "POST",
      body: JSON.stringify({ comments })
    }
  );
}

export async function rejectEnterpriseProcurementRequest(requestId: string, comments: string) {
  return apiFetch<{ success: boolean; request: ProcurementWorkspace["requests"][number]; message?: string }>(
    `/api/enterprise/procurement/requests/${requestId}/reject/`,
    {
      method: "POST",
      body: JSON.stringify({ comments })
    }
  );
}

export async function revertEnterpriseProcurementRequest(requestId: string, comments = "") {
  return apiFetch<{ success: boolean; request: ProcurementWorkspace["requests"][number]; message?: string }>(
    `/api/enterprise/procurement/requests/${requestId}/revert/`,
    {
      method: "POST",
      body: JSON.stringify({ comments })
    }
  );
}

export async function addEnterpriseProcurementApprovalComment(requestId: string, body: string) {
  return apiFetch<{ success: boolean; request: ProcurementWorkspace["requests"][number]; message?: string }>(
    `/api/enterprise/procurement/requests/${requestId}/comment/`,
    {
      method: "POST",
      body: JSON.stringify({ body })
    }
  );
}

export async function convertProcurementRequestToPurchaseOrder(
  requestId: string,
  payload: { vendor: string; warehouse: string; notes?: string }
) {
  return apiFetch<{ success: boolean; purchase_order: ProcurementWorkspace["purchase_orders"][number]; message?: string }>(
    `/api/enterprise/procurement/requests/${requestId}/convert/`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function issueEnterprisePurchaseOrder(purchaseOrderId: string) {
  return apiFetch<{ success: boolean; purchase_order: ProcurementWorkspace["purchase_orders"][number]; message?: string }>(
    `/api/enterprise/purchase-orders/${purchaseOrderId}/issue/`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function receiveEnterprisePurchaseOrder(
  purchaseOrderId: string,
  payload: {
    warehouse?: string | null;
    notes?: string;
    lines: Array<{ purchase_order_line: string; quantity_received: number }>;
  }
) {
  return apiFetch<{ success: boolean; goods_receipt: InventoryWorkspace["receipts"][number]; message?: string }>(
    `/api/enterprise/purchase-orders/${purchaseOrderId}/receive/`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function uploadEnterpriseProcurementAttachment(requestId: string, file: File, attachmentType: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("attachment_type", attachmentType);
  return apiFetch<{ success: boolean; request: ProcurementWorkspace["requests"][number]; message?: string }>(
    `/api/enterprise/procurement/requests/${requestId}/attachments/`,
    {
      method: "POST",
      body: formData
    }
  );
}

export async function uploadEnterpriseGoodsReceiptAttachment(receiptId: string, file: File, attachmentType: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("attachment_type", attachmentType);
  return apiFetch<{ success: boolean; goods_receipt: InventoryWorkspace["receipts"][number]; message?: string }>(
    `/api/enterprise/goods-receipts/${receiptId}/attachments/`,
    {
      method: "POST",
      body: formData
    }
  );
}

export async function postFinanceInvoice(invoiceId: string, payload: { amount?: number; invoice_date?: string }) {
  return apiFetch<{ success: boolean; invoice: FinanceWorkspace["invoices"][number]; message?: string }>(
    `/api/enterprise/invoices/${invoiceId}/post/`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function approveFinanceInvoice(invoiceId: string) {
  return apiFetch<{ success: boolean; invoice: FinanceWorkspace["invoices"][number]; message?: string }>(
    `/api/enterprise/invoices/${invoiceId}/approve/`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function revertFinanceInvoice(invoiceId: string, comments = "") {
  return apiFetch<{ success: boolean; invoice: FinanceWorkspace["invoices"][number]; message?: string }>(
    `/api/enterprise/invoices/${invoiceId}/revert/`,
    {
      method: "POST",
      body: JSON.stringify({ comments })
    }
  );
}

export async function addFinanceInvoiceApprovalComment(invoiceId: string, body: string) {
  return apiFetch<{ success: boolean; invoice: FinanceWorkspace["invoices"][number]; message?: string }>(
    `/api/enterprise/invoices/${invoiceId}/comment/`,
    {
      method: "POST",
      body: JSON.stringify({ body })
    }
  );
}

export async function createFinancePaymentRequest(invoiceId: string, payload: { amount?: number }) {
  return apiFetch<{ success: boolean; payment_request: FinanceWorkspace["payment_requests"][number]; message?: string }>(
    `/api/enterprise/invoices/${invoiceId}/create-payment-request/`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function uploadFinanceInvoiceAttachment(invoiceId: string, file: File, attachmentType: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("attachment_type", attachmentType);
  return apiFetch<{ success: boolean; invoice: FinanceWorkspace["invoices"][number]; message?: string }>(
    `/api/enterprise/invoices/${invoiceId}/attachments/`,
    {
      method: "POST",
      body: formData
    }
  );
}

export async function approveFinancePaymentRequest(paymentRequestId: string) {
  return apiFetch<{ success: boolean; payment_request: FinanceWorkspace["payment_requests"][number]; message?: string }>(
    `/api/enterprise/payment-requests/${paymentRequestId}/approve/`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function rejectFinancePaymentRequest(paymentRequestId: string, comments: string) {
  return apiFetch<{ success: boolean; payment_request: FinanceWorkspace["payment_requests"][number]; message?: string }>(
    `/api/enterprise/payment-requests/${paymentRequestId}/reject/`,
    {
      method: "POST",
      body: JSON.stringify({ comments })
    }
  );
}

export async function revertFinancePaymentRequest(paymentRequestId: string, comments = "") {
  return apiFetch<{ success: boolean; payment_request: FinanceWorkspace["payment_requests"][number]; message?: string }>(
    `/api/enterprise/payment-requests/${paymentRequestId}/revert/`,
    {
      method: "POST",
      body: JSON.stringify({ comments })
    }
  );
}

export async function addFinancePaymentApprovalComment(paymentRequestId: string, body: string) {
  return apiFetch<{ success: boolean; payment_request: FinanceWorkspace["payment_requests"][number]; message?: string }>(
    `/api/enterprise/payment-requests/${paymentRequestId}/comment/`,
    {
      method: "POST",
      body: JSON.stringify({ body })
    }
  );
}

export async function markFinancePaymentPaid(paymentRequestId: string, paymentReference: string) {
  return apiFetch<{ success: boolean; payment_request: FinanceWorkspace["payment_requests"][number]; message?: string }>(
    `/api/enterprise/payment-requests/${paymentRequestId}/mark-paid/`,
    {
      method: "POST",
      body: JSON.stringify({ payment_reference: paymentReference })
    }
  );
}

export async function uploadFinancePaymentRequestAttachment(paymentRequestId: string, file: File, attachmentType: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("attachment_type", attachmentType);
  return apiFetch<{ success: boolean; payment_request: FinanceWorkspace["payment_requests"][number]; message?: string }>(
    `/api/enterprise/payment-requests/${paymentRequestId}/attachments/`,
    {
      method: "POST",
      body: formData
    }
  );
}
