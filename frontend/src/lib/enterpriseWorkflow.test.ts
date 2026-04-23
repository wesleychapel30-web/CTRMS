import { describe, expect, it } from "vitest";
import {
  buildEnterpriseExportFilename,
  deriveApprovalInboxStage,
  deriveFinanceStage,
  deriveProcurementStage,
  enterpriseActionLabels,
  getApprovalPriority,
  hasWorkflowAction,
  mapEnterpriseAuditTimeline
} from "./enterpriseWorkflow";

describe("enterpriseWorkflow", () => {
  it("maps audit entries to timeline records", () => {
    const entries = mapEnterpriseAuditTimeline([
      {
        id: "1",
        label: "Approve",
        title: "ProcurementRequest",
        actor_name: "A. Manager",
        created_at: "2026-03-28T10:15:00Z",
        body: "Approved the request.",
        status_text: "Submitted -> Approved",
        tone: "success"
      }
    ]);

    expect(entries[0]).toMatchObject({
      actorName: "A. Manager",
      label: "Approve",
      tone: "success"
    });
  });

  it("exposes readable workflow action labels", () => {
    expect(enterpriseActionLabels.convert_to_purchase_order).toBe("Convert to PO");
    expect(enterpriseActionLabels.mark_paid).toBe("Mark as Paid");
  });

  it("checks whether an action is available", () => {
    expect(hasWorkflowAction(["approve", "reject"], "approve")).toBe(true);
    expect(hasWorkflowAction(["approve"], "mark_paid")).toBe(false);
  });

  it("builds clean enterprise export filenames", () => {
    expect(buildEnterpriseExportFilename("Payment Requests")).toMatch(/^enterprise-payment-requests-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("maps submitted procurement requests into finance review when the next step is finance", () => {
    const stage = deriveProcurementStage({
      id: "req-1",
      request_number: "PR-001",
      title: "Regional laptops",
      justification: "Refresh",
      needed_by_date: null,
      department: "dep-1",
      budget_account: null,
      requested_by: null,
      status: "submitted",
      status_display: "Submitted",
      total_amount: 4500000,
      submitted_at: "2026-04-20T08:00:00Z",
      approved_at: null,
      rejected_at: null,
      converted_at: null,
      available_actions: ["approve", "reject"],
      is_locked: true,
      audit_timeline: [],
      attachments: [],
      lines: [],
      created_at: "2026-04-20T08:00:00Z",
      approval_instance: {
        id: "app-1",
        target_type: "procurement_request",
        status: "pending",
        current_step: 2,
        submitted_at: "2026-04-20T08:00:00Z",
        completed_at: null,
        pending_step_name: "Finance budget confirmation",
        pending_role_key: "finance_officer",
        decisions: []
      }
    });

    expect(stage.label).toBe("Finance Review");
    expect(stage.queue).toBe("review");
  });

  it("maps approved procurement records with posted invoices into pending payment", () => {
    const stage = deriveProcurementStage(
      {
        id: "req-2",
        request_number: "PR-002",
        title: "Scanner fleet",
        justification: "Warehouse upgrade",
        needed_by_date: null,
        department: "dep-1",
        budget_account: null,
        requested_by: null,
        status: "converted",
        status_display: "Converted",
        total_amount: 9200000,
        submitted_at: "2026-04-18T08:00:00Z",
        approved_at: "2026-04-19T08:00:00Z",
        rejected_at: null,
        converted_at: "2026-04-20T08:00:00Z",
        purchase_order_id: "po-1",
        purchase_order_number: "PO-001",
        available_actions: [],
        is_locked: true,
        audit_timeline: [],
        attachments: [],
        lines: [],
        created_at: "2026-04-18T08:00:00Z"
      },
      {
        id: "po-1",
        po_number: "PO-001",
        procurement_request: "req-2",
        status: "received",
        status_display: "Received",
        vendor: "vendor-1",
        warehouse: "wh-1",
        notes: "",
        total_amount: 9200000,
        issued_at: "2026-04-20T12:00:00Z",
        available_actions: [],
        is_locked: true,
        audit_timeline: [],
        lines: [],
        created_at: "2026-04-20T08:00:00Z"
      },
      {
        invoice: {
          id: "inv-1",
          invoice_number: "INV-001",
          purchase_order: "po-1",
          status: "posted",
          status_display: "Posted",
          vendor: "vendor-1",
          amount: 9200000,
          invoice_date: "2026-04-21",
          posted_at: "2026-04-21T10:00:00Z",
          approved_at: null,
          paid_at: null,
          payment_reference: "",
          available_actions: ["approve"],
          is_locked: true,
          audit_timeline: [],
          attachments: []
        }
      }
    );

    expect(stage.label).toBe("Pending Payment");
    expect(stage.queue).toBe("payment");
  });

  it("maps finance invoices with paid payment requests into the closed queue", () => {
    const stage = deriveFinanceStage(
      {
        id: "inv-2",
        invoice_number: "INV-200",
        purchase_order: "po-2",
        status: "paid",
        status_display: "Paid",
        vendor: "vendor-2",
        amount: 1200000,
        invoice_date: "2026-04-10",
        posted_at: "2026-04-10T08:00:00Z",
        approved_at: "2026-04-11T08:00:00Z",
        paid_at: "2026-04-12T08:00:00Z",
        payment_reference: "TX-1",
        available_actions: [],
        is_locked: true,
        audit_timeline: [],
        attachments: []
      },
      {
        id: "pay-1",
        payment_request_number: "PAY-1",
        invoice: "inv-2",
        status: "paid",
        status_display: "Paid",
        amount: 1200000,
        requested_by: null,
        approved_at: "2026-04-11T08:00:00Z",
        paid_at: "2026-04-12T08:00:00Z",
        payment_reference: "TX-1",
        available_actions: [],
        audit_timeline: [],
        attachments: [],
        created_at: "2026-04-11T08:00:00Z"
      }
    );

    expect(stage.label).toBe("Closed");
    expect(stage.queue).toBe("closed");
  });

  it("marks old high-value approvals as urgent", () => {
    const priority = getApprovalPriority({
      id: "approval-1",
      module_key: "procurement",
      module_label: "Procurement",
      entity_type: "procurement_request",
      record_id: "req-3",
      record_number: "PR-003",
      title: "Regional vehicle lease",
      subtitle: "Transport support",
      status: "submitted",
      status_display: "Submitted",
      department_name: "Operations",
      branch_name: "",
      requested_by_name: "Ops Lead",
      amount: 14500000,
      pending_step_name: "Administrative review",
      pending_role_key: "director",
      created_at: "2026-04-15T08:00:00Z",
      available_actions: ["approve"],
      href: "/procurement?request=req-3"
    });

    expect(priority.label).toBe("Urgent");
  });

  it("maps procurement inbox items to director review by default", () => {
    const stage = deriveApprovalInboxStage({
      id: "approval-2",
      module_key: "procurement",
      module_label: "Procurement",
      entity_type: "procurement_request",
      record_id: "req-4",
      record_number: "PR-004",
      title: "Event sponsorship materials",
      subtitle: "Awaiting approval",
      status: "submitted",
      status_display: "Submitted",
      department_name: "Programs",
      branch_name: "",
      requested_by_name: "Programs Lead",
      amount: 850000,
      pending_step_name: "Administrative review",
      pending_role_key: "admin",
      created_at: "2026-04-22T08:00:00Z",
      available_actions: ["approve", "reject"],
      href: "/procurement?request=req-4"
    });

    expect(stage.label).toBe("Director Review");
  });
});
