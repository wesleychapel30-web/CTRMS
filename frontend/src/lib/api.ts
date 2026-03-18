import type {
  ActivityLogRecord,
  AdminOverview,
  ApiListResponse,
  BrandingSettings,
  DashboardOverview,
  DocumentRecord,
  InvitationRecord,
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
    const message = data?.error ?? data?.detail ?? "Request failed";
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  return `${base}${normalizedPath}`;
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
