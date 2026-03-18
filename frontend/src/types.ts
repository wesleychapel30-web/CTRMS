import type { LucideIcon } from "lucide-react";

export type ThemeMode = "light" | "dark";

export type Tone = "accent" | "success" | "warning" | "danger";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  group?: string;
  requires?: string[];
};

export type Stat = {
  label: string;
  value: string;
  change: string;
  tone: Tone;
};

export type ChartDatum = {
  label: string;
  value: number;
  color?: string;
};

export type TimelineItem = {
  title: string;
  subtitle: string;
  date: string;
  tone: Tone;
};

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  primary_role?: string;
  roles?: string[];
  additional_roles?: string[];
  department: string;
  is_staff: boolean;
  is_active_staff?: boolean;
  is_active?: boolean;
  is_archived?: boolean;
  force_password_change?: boolean;
  permissions: string[];
};

export type ApiListResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type RequestDocumentRecord = {
  id: string;
  document: string;
  filename?: string;
  download_url?: string;
  document_type: string;
  uploaded_by: string | null;
  uploaded_by_name?: string;
  uploaded_at: string;
};

export type RequestHistoryRecord = {
  id: string;
  action: string;
  from_status: string;
  to_status: string;
  comment: string;
  performed_by: string | null;
  performed_by_name?: string;
  created_at: string;
};

export type RecordTimelineEntryRecord = {
  id: string;
  entry_type: string;
  label: string;
  actor_name: string;
  title: string;
  body: string;
  old_status: string;
  new_status: string;
  is_internal: boolean;
  created_at: string;
};

export type RequestRecord = {
  id: string;
  request_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string;
  applicant_id: string;
  applicant_organization: string;
  applicant_role: string;
  applicant_region: string;
  address: string;
  title: string;
  category: string;
  category_display: string;
  description: string;
  number_of_beneficiaries: number | null;
  amount_requested: number;
  approved_amount: number | null;
  disbursed_amount: number | null;
  remaining_balance: number;
  status: string;
  status_display: string;
  reviewed_by: string | null;
  reviewed_by_name?: string;
  review_notes: string;
  reviewed_at: string | null;
  payment_date: string | null;
  payment_method: string;
  payment_reference: string;
  created_by: string | null;
  created_by_name?: string;
  documents: RequestDocumentRecord[];
  history?: RequestHistoryRecord[];
  timeline_entries?: RecordTimelineEntryRecord[];
  created_at: string;
  updated_at: string;
};

export type InvitationAttachmentRecord = {
  id: string;
  file: string;
  filename?: string;
  download_url?: string;
  attachment_type: string;
  uploaded_by: string | null;
  uploaded_by_name?: string;
  uploaded_at: string;
};

export type InvitationHistoryRecord = {
  id: string;
  action_type: string;
  action_label: string;
  label: string;
  actor_name: string;
  description: string;
  comment: string;
  from_status?: string;
  to_status?: string;
  created_at: string;
};

export type InvitationRecord = {
  id: string;
  inviting_organization: string;
  event_title: string;
  description: string;
  location: string;
  event_date: string;
  event_duration_hours: number;
  status: string;
  status_display: string;
  reviewed_by: string | null;
  reviewed_by_name?: string;
  review_notes: string;
  reviewed_at: string | null;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  rsvp_required: boolean;
  expected_attendees: number | null;
  special_requirements: string;
  reminder_3_days_sent: boolean;
  reminder_1_day_sent: boolean;
  attachments: InvitationAttachmentRecord[];
  history?: InvitationHistoryRecord[];
  timeline_entries?: RecordTimelineEntryRecord[];
  is_upcoming: boolean;
  created_at: string;
  updated_at: string;
};

export type ActivityLogRecord = {
  id: string;
  user: string;
  action_type: string;
  action_label: string;
  content_type: string;
  object_id: string;
  description: string;
  message?: string;
  created_at: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  href: string | null;
  kind: "audit" | "event" | "system";
  is_read: boolean;
};

export type SearchResult = {
  type: "request" | "invitation";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export type BrandingSettings = {
  site_name: string;
  organization_name: string;
  logo_url: string;
  favicon_url: string;
  banner_url: string;
  primary_color: string;
  secondary_color: string;
};

export type DocumentRecord = {
  id: string;
  name: string;
  type: string;
  record_type: "request" | "invitation";
  linked_record: string;
  url: string;
  uploaded_at: string;
};

export type DashboardOverview = {
  stats: {
    total_requests: number;
    pending_requests: number;
    under_review: number;
    approved_requests: number;
    rejected_requests: number;
    paid_requests: number;
    upcoming_invitations: number;
    events_next_week: number;
    total_requested: number;
    total_approved: number;
    total_disbursed: number;
    approval_rate: number;
  };
  charts: {
    category_breakdown: ChartDatum[];
    monthly_trend: ChartDatum[];
    approval_rate: ChartDatum[];
  };
  timeline: TimelineItem[];
};

export type AdminOverview = {
  summary: {
    active_users: number;
    directors: number;
    admins: number;
    audit_events_today: number;
    departments: number;
  };
  users: Array<{
    id: string;
    name: string;
    username: string;
    email: string;
    role: string;
    role_label: string;
    roles?: string[];
    additional_roles?: string[];
    department: string;
    is_active: boolean;
    is_active_staff?: boolean;
    is_archived?: boolean;
    force_password_change?: boolean;
  }>;
};

export type SettingsOverview = {
  organization_settings: {
    organization_name: string;
    organization_email: string;
    organization_phone: string;
    organization_address: string;
    website_url: string;
    primary_color: string;
    secondary_color: string;
    logo_url?: string;
    favicon_url?: string;
    banner_url?: string;
  };
  system_settings: {
    site_name: string;
    organization_name: string;
    organization_email: string;
    support_email: string;
    email_notifications_enabled: boolean;
    sms_notifications_enabled: boolean;
    backup_frequency: string;
    backup_retention_days: number;
    event_reminder_3_days_enabled: boolean;
    event_reminder_1_day_enabled: boolean;
    smtp_host: string;
    smtp_port: number;
    smtp_username: string;
    smtp_password: string;
    smtp_password_configured: boolean;
    smtp_use_tls: boolean;
    smtp_use_ssl: boolean;
    sender_name: string;
    sender_email: string;
  };
};

export type RequestReportSummary = {
  total_requests: number;
  draft_requests?: number;
  approved_requests: number;
  pending_requests: number;
  under_review_requests?: number;
  rejected_requests?: number;
  partially_paid_requests?: number;
  paid_requests?: number;
  total_amount_requested: number;
  total_approved: number;
  total_disbursed: number;
  category_stats: Record<string, { count: number; total_amount: number }>;
  charts?: {
    category_breakdown: ChartDatum[];
    monthly_trend: ChartDatum[];
    approval_rate: ChartDatum[];
  };
};
