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

export type EnterpriseOrganization = {
  id: string;
  name: string;
  code: string;
  slug: string;
  legal_name: string;
  timezone: string;
  currency_code: string;
  is_active: boolean;
};

export type EnterpriseDepartment = {
  id: string;
  name: string;
  code: string;
  description: string;
  manager: string | null;
  manager_name?: string;
  is_active: boolean;
};

export type EnterpriseBranch = {
  id: string;
  name: string;
  code: string;
  city: string;
  country: string;
  address: string;
  is_active: boolean;
};

export type EnterpriseVendor = {
  id: string;
  name: string;
  code: string;
  contact_name: string;
  email: string;
  phone: string;
  status: string;
  status_display: string;
};

export type EnterpriseProduct = {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit_of_measure: string;
  standard_cost: number;
  reorder_level: number;
  is_active: boolean;
  on_hand: number;
};

export type EnterpriseWarehouse = {
  id: string;
  name: string;
  code: string;
  location: string;
  branch: string | null;
  branch_name?: string;
  is_active: boolean;
};

export type EnterpriseBudgetAccount = {
  id: string;
  code: string;
  name: string;
  fiscal_year: number;
  department: string | null;
  department_name?: string;
  allocated_amount: number;
  committed_amount: number;
  spent_amount: number;
  available_amount: number;
};

export type EnterpriseApprovalDecision = {
  id: string;
  step_name: string;
  role_key?: string;
  status: string;
  actor_name?: string;
  comments: string;
  decided_at: string | null;
};

export type EnterpriseApprovalInstance = {
  id: string;
  target_type: string;
  status: string;
  current_step: number;
  submitted_at: string;
  completed_at: string | null;
  pending_step_name?: string;
  pending_role_key?: string;
  decisions: EnterpriseApprovalDecision[];
};

export type EnterpriseAuditEntry = {
  id: string;
  label: string;
  title: string;
  actor_name: string;
  created_at: string;
  body?: string | null;
  status_text?: string | null;
  tone: "neutral" | "info" | "success" | "danger" | "warning";
};

export type EnterpriseAttachmentRecord = {
  id: string;
  file: string;
  filename?: string;
  download_url?: string;
  attachment_type: string;
  uploaded_by: string | null;
  uploaded_by_name?: string;
  uploaded_at: string;
};

export type EnterpriseWorkflowAction =
  | "edit"
  | "submit"
  | "approve"
  | "reject"
  | "revert"
  | "convert_to_purchase_order"
  | "issue"
  | "record_goods_receipt"
  | "post"
  | "create_payment_request"
  | "mark_paid";

export type EnterpriseWorkflowStep = {
  id: string;
  sequence: number;
  name: string;
  role_key?: string;
  role_name?: string;
  minimum_amount: number | null;
  maximum_amount: number | null;
};

export type EnterpriseWorkflowTemplate = {
  id: string;
  name: string;
  code: string;
  module_key: string;
  description: string;
  is_active: boolean;
  steps: EnterpriseWorkflowStep[];
};

export type ProcurementRequestLineRecord = {
  id: string;
  line_number: number;
  description: string;
  product: string | null;
  product_name?: string;
  unit_of_measure: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type ProcurementRequestRecord = {
  id: string;
  request_number: string;
  title: string;
  justification: string;
  needed_by_date: string | null;
  department: string;
  department_name?: string;
  budget_account: string | null;
  budget_account_name?: string;
  requested_by: string | null;
  requested_by_name?: string;
  status: string;
  status_display: string;
  total_amount: number;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  converted_at: string | null;
  purchase_order_id?: string | null;
  purchase_order_number?: string | null;
  available_actions: EnterpriseWorkflowAction[];
  is_locked: boolean;
  audit_timeline: EnterpriseAuditEntry[];
  approval_history?: EnterpriseAuditEntry[];
  attachments: EnterpriseAttachmentRecord[];
  lines: ProcurementRequestLineRecord[];
  approval_instance?: EnterpriseApprovalInstance | null;
  created_at: string;
};

export type PurchaseOrderLineRecord = {
  id: string;
  line_number: number;
  description: string;
  product: string | null;
  product_name?: string;
  unit_of_measure: string;
  quantity_ordered: number;
  quantity_received: number;
  outstanding_quantity: number;
  unit_price: number;
  line_total: number;
};

export type PurchaseOrderRecord = {
  id: string;
  po_number: string;
  procurement_request: string;
  procurement_request_number?: string;
  vendor: string;
  vendor_name?: string;
  warehouse: string;
  warehouse_name?: string;
  branch_name?: string;
  status: string;
  status_display: string;
  notes: string;
  total_amount: number;
  issued_at: string | null;
  available_actions: EnterpriseWorkflowAction[];
  is_locked: boolean;
  audit_timeline: EnterpriseAuditEntry[];
  lines: PurchaseOrderLineRecord[];
  created_at: string;
};

export type GoodsReceiptLineRecord = {
  id: string;
  product: string;
  product_name?: string;
  quantity_received: number;
};

export type GoodsReceiptRecord = {
  id: string;
  receipt_number: string;
  purchase_order: string;
  purchase_order_number?: string;
  warehouse: string;
  warehouse_name?: string;
  received_by: string | null;
  received_by_name?: string;
  status: string;
  notes: string;
  received_at: string;
  lines: GoodsReceiptLineRecord[];
  ledger_entries: InventoryLedgerEntryRecord[];
  audit_timeline: EnterpriseAuditEntry[];
  attachments: EnterpriseAttachmentRecord[];
};

export type InventoryLedgerEntryRecord = {
  id: string;
  product: string;
  product_name?: string;
  warehouse: string;
  warehouse_name?: string;
  movement_type: string;
  movement_type_display?: string;
  quantity: number;
  unit_cost: number;
  reference_type: string;
  reference_number: string;
  occurred_at: string;
};

export type FinanceInvoiceRecord = {
  id: string;
  invoice_number: string;
  purchase_order: string;
  purchase_order_number?: string;
  vendor: string;
  vendor_name?: string;
  branch_name?: string;
  department_name?: string;
  status: string;
  status_display: string;
  amount: number;
  invoice_date: string;
  posted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  payment_reference: string;
  payment_request_id?: string | null;
  payment_request_number?: string | null;
  payment_request_status?: string | null;
  available_actions: EnterpriseWorkflowAction[];
  is_locked: boolean;
  audit_timeline: EnterpriseAuditEntry[];
  approval_history?: EnterpriseAuditEntry[];
  attachments: EnterpriseAttachmentRecord[];
};

export type EnterprisePaymentRequestRecord = {
  id: string;
  payment_request_number: string;
  invoice: string;
  invoice_number?: string;
  branch_name?: string;
  department_name?: string;
  status: string;
  status_display: string;
  amount: number;
  requested_by: string | null;
  requested_by_name?: string;
  approved_at: string | null;
  paid_at: string | null;
  payment_reference: string;
  available_actions: EnterpriseWorkflowAction[];
  audit_timeline: EnterpriseAuditEntry[];
  approval_history?: EnterpriseAuditEntry[];
  attachments: EnterpriseAttachmentRecord[];
  created_at: string;
};

export type EnterpriseOverview = {
  organization: EnterpriseOrganization | null;
  summary: {
    organizations: number;
    departments: number;
    active_workflows: number;
    open_purchase_requests: number;
    issued_purchase_orders: number;
    inventory_units: number;
    draft_invoices: number;
    pending_payments: number;
    committed_budget: number;
    spent_budget: number;
    my_pending_approvals: number;
  };
  charts: {
    procurement_pipeline: ChartDatum[];
    module_mix: ChartDatum[];
    spend_trend: ChartDatum[];
  };
  timeline: TimelineItem[];
  alerts: Array<{ title: string; message: string }>;
};

export type ProcurementWorkspace = {
  organization: EnterpriseOrganization | null;
  summary: {
    draft_requests: number;
    submitted_requests: number;
    approved_requests: number;
    converted_requests: number;
    issued_orders: number;
    receiving_orders: number;
  };
  requests: ProcurementRequestRecord[];
  purchase_orders: PurchaseOrderRecord[];
  approval_queue: EnterpriseApprovalInstance[];
  vendors: EnterpriseVendor[];
  departments: EnterpriseDepartment[];
  budget_accounts: EnterpriseBudgetAccount[];
  products: EnterpriseProduct[];
  warehouses: EnterpriseWarehouse[];
};

export type InventoryWorkspace = {
  organization: EnterpriseOrganization | null;
  summary: {
    warehouses: number;
    receipts_posted: number;
    inventory_lines: number;
    stock_alerts: number;
    receivable_orders: number;
  };
  warehouses: EnterpriseWarehouse[];
  receipts: GoodsReceiptRecord[];
  ledger: InventoryLedgerEntryRecord[];
  products: EnterpriseProduct[];
  receivable_orders: PurchaseOrderRecord[];
};

export type FinanceWorkspace = {
  organization: EnterpriseOrganization | null;
  summary: {
    draft_invoices: number;
    posted_invoices: number;
    approved_invoices: number;
    pending_payments: number;
    paid_requests: number;
    budget_risk_accounts: number;
  };
  budgets: EnterpriseBudgetAccount[];
  invoices: FinanceInvoiceRecord[];
  payment_requests: EnterprisePaymentRequestRecord[];
};

export type OrganizationWorkspace = {
  organization: EnterpriseOrganization | null;
  organizations: EnterpriseOrganization[];
  departments: EnterpriseDepartment[];
  branches: EnterpriseBranch[];
  workflows: EnterpriseWorkflowTemplate[];
};

export type ApprovalInboxItem = {
  id: string;
  module_key: "procurement" | "finance";
  module_label: string;
  entity_type: "procurement_request" | "finance_invoice" | "payment_request";
  record_id: string;
  record_number: string;
  title: string;
  subtitle: string;
  status: string;
  status_display: string;
  department_name: string;
  branch_name: string;
  requested_by_name: string;
  amount: number;
  pending_step_name: string;
  pending_role_key: string;
  created_at: string;
  available_actions: EnterpriseWorkflowAction[];
  href: string;
};

export type ApprovalInbox = {
  summary: {
    pending_items: number;
    procurement_items: number;
    finance_items: number;
    total_amount: number;
  };
  items: ApprovalInboxItem[];
  filters: {
    modules: string[];
    statuses: string[];
    branches: string[];
    departments: string[];
  };
};
