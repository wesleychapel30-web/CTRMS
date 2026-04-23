import { Download, Plus } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { DetailSectionCard } from "../components/DetailSectionCard";
import { EnterpriseAttachmentPanel } from "../components/EnterpriseAttachmentPanel";
import { EnterpriseTimeline } from "../components/EnterpriseTimeline";
import { InlineBanner, StatePanel } from "../components/FeedbackStates";
import { FilterBar } from "../components/FilterBar";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { WorkflowActionBar } from "../components/WorkflowActionBar";
import { WorkspaceTabs } from "../components/WorkspaceTabs";
import { useSession } from "../context/SessionContext";
import { useToast } from "../context/ToastContext";
import {
  addEnterpriseProcurementApprovalComment,
  approveEnterpriseProcurementRequest,
  convertProcurementRequestToPurchaseOrder,
  createProcurementRequest,
  fetchFinanceWorkspace,
  fetchProcurementWorkspace,
  issueEnterprisePurchaseOrder,
  rejectEnterpriseProcurementRequest,
  revertEnterpriseProcurementRequest,
  submitProcurementRequest,
  updateProcurementRequest,
  uploadEnterpriseProcurementAttachment
} from "../lib/api";
import {
  buildEnterpriseExportFilename,
  deriveProcurementStage,
  downloadCsvFile,
  type WorkflowQueueKey,
  type WorkflowStageDescriptor
} from "../lib/enterpriseWorkflow";
import { formatCurrency, formatDate, formatDateTime } from "../lib/format";
import type {
  EnterpriseBudgetAccount,
  EnterprisePaymentRequestRecord,
  EnterpriseProduct,
  EnterpriseWorkflowAction,
  FinanceInvoiceRecord,
  FinanceWorkspace,
  ProcurementRequestRecord,
  ProcurementWorkspace,
  PurchaseOrderRecord,
  Stat
} from "../types";

type RequestLineForm = {
  product: string;
  description: string;
  unit_of_measure: string;
  quantity: string;
  unit_price: string;
};

type RequestFormState = {
  title: string;
  justification: string;
  needed_by_date: string;
  department: string;
  budget_account: string;
  lines: RequestLineForm[];
};

type ProcurementQueueTab = WorkflowQueueKey;
type InspectorTab = "overview" | "items" | "approval" | "timeline" | "attachments" | "finance";

type EnrichedProcurementRow = {
  request: ProcurementRequestRecord;
  order: PurchaseOrderRecord | null;
  invoice: FinanceInvoiceRecord | null;
  payment: EnterprisePaymentRequestRecord | null;
  stage: WorkflowStageDescriptor;
};

function emptyLine(): RequestLineForm {
  return {
    product: "",
    description: "",
    unit_of_measure: "unit",
    quantity: "1",
    unit_price: "0"
  };
}

function buildFormState(
  requestRecord: ProcurementRequestRecord | null,
  workspace: Pick<ProcurementWorkspace, "departments" | "budget_accounts">
): RequestFormState {
  return {
    title: requestRecord?.title ?? "",
    justification: requestRecord?.justification ?? "",
    needed_by_date: requestRecord?.needed_by_date ?? "",
    department: requestRecord?.department ?? workspace.departments[0]?.id ?? "",
    budget_account: requestRecord?.budget_account ?? workspace.budget_accounts[0]?.id ?? "",
    lines:
      requestRecord?.lines.map((line) => ({
        product: line.product ?? "",
        description: line.description,
        unit_of_measure: line.unit_of_measure,
        quantity: String(line.quantity),
        unit_price: String(line.unit_price)
      })) ?? [emptyLine()]
  };
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unable to complete the procurement action";
}

function queueTabLabel(tab: ProcurementQueueTab) {
  if (tab === "review") {
    return "Review";
  }
  if (tab === "processing") {
    return "Processing";
  }
  if (tab === "delivery") {
    return "Delivery";
  }
  if (tab === "payment") {
    return "Pending Payment";
  }
  return "History";
}

function stagePill(stage: WorkflowStageDescriptor) {
  const toneClass =
    stage.tone === "danger"
      ? "bg-rose-100 text-rose-800"
      : stage.tone === "warning"
        ? "bg-amber-100 text-amber-800"
        : stage.tone === "success"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-[var(--accent-soft)] text-[var(--accent)]";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${toneClass}`}>{stage.label}</span>;
}

export function ProcurementPage() {
  const { hasAnyPermission } = useSession();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [workspace, setWorkspace] = useState<ProcurementWorkspace | null>(null);
  const [financeWorkspace, setFinanceWorkspace] = useState<FinanceWorkspace | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [formState, setFormState] = useState<RequestFormState | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [convertVendorId, setConvertVendorId] = useState("");
  const [convertWarehouseId, setConvertWarehouseId] = useState("");
  const [convertNotes, setConvertNotes] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [queueTab, setQueueTab] = useState<ProcurementQueueTab>("review");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [actingAction, setActingAction] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = async (options?: { focusRequestId?: string | null; focusOrderId?: string | null }) => {
    setIsLoading(true);
    try {
      const [procurementPayload, financePayload] = await Promise.all([fetchProcurementWorkspace(), fetchFinanceWorkspace()]);
      const requestedOrderId = options?.focusOrderId ?? searchParams.get("order") ?? selectedOrderId ?? null;
      const orderFromQuery = requestedOrderId ? procurementPayload.purchase_orders.find((item) => item.id === requestedOrderId) ?? null : null;
      const nextRequestId =
        options?.focusRequestId ??
        orderFromQuery?.procurement_request ??
        searchParams.get("request") ??
        selectedRequestId ??
        procurementPayload.requests[0]?.id ??
        null;
      const nextOrderId =
        options?.focusOrderId ??
        procurementPayload.purchase_orders.find((item) => item.procurement_request === nextRequestId)?.id ??
        orderFromQuery?.id ??
        null;

      setWorkspace(procurementPayload);
      setFinanceWorkspace(financePayload);
      setSelectedRequestId(nextRequestId);
      setSelectedOrderId(nextOrderId || null);
      setConvertVendorId((current) => current || procurementPayload.vendors[0]?.id || "");
      setConvertWarehouseId((current) => current || procurementPayload.warehouses[0]?.id || "");
      setError(null);

      const requestToEdit = procurementPayload.requests.find((item) => item.id === nextRequestId && item.status === "draft");
      if (requestToEdit && !isCreating) {
        setFormState(buildFormState(requestToEdit, procurementPayload));
      } else if (!procurementPayload.requests.length && !formState) {
        setFormState(buildFormState(null, procurementPayload));
      }
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const currencyCode = workspace?.organization?.currency_code ?? financeWorkspace?.organization?.currency_code ?? "TZS";
  const canUploadAttachments = hasAnyPermission(["procurement:create", "procurement:approve", "purchase_order:issue"]);

  const ordersByRequestId = useMemo(
    () => new Map((workspace?.purchase_orders ?? []).map((order) => [order.procurement_request, order])),
    [workspace?.purchase_orders]
  );
  const invoicesByPurchaseOrderId = useMemo(
    () => new Map((financeWorkspace?.invoices ?? []).map((invoice) => [invoice.purchase_order, invoice])),
    [financeWorkspace?.invoices]
  );
  const paymentsByInvoiceId = useMemo(
    () => new Map((financeWorkspace?.payment_requests ?? []).map((payment) => [payment.invoice, payment])),
    [financeWorkspace?.payment_requests]
  );
  const productsById = useMemo(() => new Map((workspace?.products ?? []).map((product) => [product.id, product])), [workspace?.products]);

  const requestRows = useMemo<EnrichedProcurementRow[]>(() => {
    if (!workspace) {
      return [];
    }
    return workspace.requests.map((request) => {
      const order = request.purchase_order_id
        ? workspace.purchase_orders.find((item) => item.id === request.purchase_order_id) ?? ordersByRequestId.get(request.id) ?? null
        : ordersByRequestId.get(request.id) ?? null;
      const invoice = order ? invoicesByPurchaseOrderId.get(order.id) ?? null : null;
      const payment = invoice ? paymentsByInvoiceId.get(invoice.id) ?? null : null;
      return {
        request,
        order,
        invoice,
        payment,
        stage: deriveProcurementStage(request, order, { invoice, payment })
      };
    });
  }, [financeWorkspace, invoicesByPurchaseOrderId, ordersByRequestId, paymentsByInvoiceId, workspace]);

  const queueTabs = useMemo(
    () => [
      { key: "review" as const, label: "Review", badge: requestRows.filter((row) => row.stage.queue === "review").length },
      { key: "processing" as const, label: "Processing", badge: requestRows.filter((row) => row.stage.queue === "processing").length },
      { key: "delivery" as const, label: "Delivery", badge: requestRows.filter((row) => row.stage.queue === "delivery").length },
      { key: "payment" as const, label: "Pending Payment", badge: requestRows.filter((row) => row.stage.queue === "payment").length },
      { key: "closed" as const, label: "History", badge: requestRows.filter((row) => row.stage.queue === "closed").length }
    ],
    [requestRows]
  );

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return requestRows.filter((row) => {
      if (row.stage.queue !== queueTab) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = `${row.request.request_number} ${row.request.title} ${row.request.justification} ${row.request.department_name ?? ""} ${row.order?.po_number ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [queueTab, requestRows, searchQuery]);

  const selectedRow =
    (selectedRequestId ? requestRows.find((row) => row.request.id === selectedRequestId) : null) ??
    filteredRows[0] ??
    requestRows[0] ??
    null;
  const selectedRequest = isCreating ? null : selectedRow?.request ?? null;
  const selectedOrder =
    selectedRow?.order ??
    (selectedOrderId ? workspace?.purchase_orders.find((item) => item.id === selectedOrderId) ?? null : null) ??
    null;
  const selectedInvoice = selectedRow?.invoice ?? (selectedOrder ? invoicesByPurchaseOrderId.get(selectedOrder.id) ?? null : null);
  const selectedPayment = selectedInvoice ? paymentsByInvoiceId.get(selectedInvoice.id) ?? null : null;
  const selectedStage =
    selectedRequest && !isCreating ? deriveProcurementStage(selectedRequest, selectedOrder, { invoice: selectedInvoice, payment: selectedPayment }) : null;
  const selectedRequestActions = selectedRequest?.available_actions ?? [];
  const selectedOrderActions = (selectedOrder?.available_actions ?? []).filter((action) => action !== "record_goods_receipt");
  const isEditingDraft = Boolean(selectedRequest && selectedRequest.status === "draft" && !isCreating);

  useEffect(() => {
    if (!workspace) {
      return;
    }
    if (isCreating) {
      setFormState((current) => current ?? buildFormState(null, workspace));
      return;
    }
    if (selectedRequest && selectedRequest.status === "draft") {
      setFormState(buildFormState(selectedRequest, workspace));
    } else if (!selectedRequest) {
      setFormState(buildFormState(null, workspace));
    }
  }, [isCreating, selectedRequestId, selectedRequest, workspace]);

  useEffect(() => {
    setApprovalComment("");
    setConvertNotes("");
    setInspectorTab("overview");
  }, [selectedRequestId, isCreating]);

  const stats: Stat[] = [
    { label: "Draft Requests", value: String(workspace?.summary.draft_requests ?? 0), change: "Still editable", tone: "accent" },
    { label: "In Review", value: String(requestRows.filter((row) => row.stage.queue === "review").length), change: "Director and finance review", tone: "warning" },
    { label: "Processing", value: String(requestRows.filter((row) => row.stage.queue === "processing").length), change: "Approved and moving to PO", tone: "accent" },
    { label: "Awaiting Delivery", value: String(requestRows.filter((row) => row.stage.queue === "delivery").length), change: "Issued or partially received", tone: "success" },
    { label: "Pending Payment", value: String(requestRows.filter((row) => row.stage.queue === "payment").length), change: "Received and passed to finance", tone: "danger" }
  ];

  const updateLine = (index: number, patch: Partial<RequestLineForm>) => {
    setFormState((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line))
      };
    });
  };

  const addLine = () => {
    setFormState((current) => (current ? { ...current, lines: [...current.lines, emptyLine()] } : current));
  };

  const removeLine = (index: number) => {
    setFormState((current) => {
      if (!current) {
        return current;
      }
      const nextLines = current.lines.filter((_, lineIndex) => lineIndex !== index);
      return { ...current, lines: nextLines.length ? nextLines : [emptyLine()] };
    });
  };

  const validateForm = () => {
    if (!formState) {
      return "The procurement form is not ready yet.";
    }
    if (!formState.title.trim()) {
      return "Enter a request title.";
    }
    if (!formState.department) {
      return "Select a department.";
    }
    if (!formState.lines.length || formState.lines.every((line) => !line.description.trim())) {
      return "Add at least one line item with a description.";
    }
    for (const line of formState.lines) {
      if (!line.description.trim()) {
        return "Every line item needs a description.";
      }
      if (Number(line.quantity) <= 0) {
        return "Line quantities must be greater than zero.";
      }
      if (Number(line.unit_price) < 0) {
        return "Unit price cannot be negative.";
      }
    }
    return null;
  };

  const saveDraft = async (submitAfterSave: boolean) => {
    if (!workspace || !formState) {
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      toast.warning(validationError);
      return;
    }

    const payload = {
      title: formState.title.trim(),
      justification: formState.justification.trim(),
      needed_by_date: formState.needed_by_date || null,
      department: formState.department,
      budget_account: formState.budget_account || null,
      lines: formState.lines.map((line) => ({
        product: line.product || null,
        description: line.description.trim(),
        unit_of_measure: line.unit_of_measure.trim() || "unit",
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price)
      }))
    };

    setActingAction(submitAfterSave ? "submit" : "edit");
    try {
      const response =
        isCreating || !selectedRequest
          ? await createProcurementRequest(payload)
          : await updateProcurementRequest(selectedRequest.id, payload);

      const savedRequestId = response.request.id;
      setIsCreating(false);
      if (submitAfterSave) {
        await submitProcurementRequest(savedRequestId);
        toast.success("Procurement request submitted.");
        setQueueTab("review");
      } else {
        toast.success(isCreating ? "Draft procurement request created." : "Draft procurement request updated.");
      }
      await loadWorkspace({ focusRequestId: savedRequestId });
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setActingAction(null);
    }
  };

  const handleRequestAction = async (action: EnterpriseWorkflowAction) => {
    if (!selectedRequest || !workspace) {
      return;
    }
    setActingAction(action);
    try {
      if (action === "submit") {
        await saveDraft(true);
        return;
      }
      if (action === "approve") {
        const response = await approveEnterpriseProcurementRequest(selectedRequest.id, approvalComment.trim());
        toast.success(response.message ?? `${selectedRequest.request_number} approved.`);
      }
      if (action === "reject") {
        if (!approvalComment.trim()) {
          toast.warning("Add a rejection note before sending this request back.");
          return;
        }
        const response = await rejectEnterpriseProcurementRequest(selectedRequest.id, approvalComment.trim());
        toast.success(response.message ?? `${selectedRequest.request_number} rejected.`);
      }
      if (action === "revert") {
        const response = await revertEnterpriseProcurementRequest(selectedRequest.id, approvalComment.trim());
        toast.success(response.message ?? `${selectedRequest.request_number} returned to review.`);
      }
      if (action === "convert_to_purchase_order") {
        if (!convertVendorId || !convertWarehouseId) {
          toast.warning("Select both a vendor and a warehouse before creating the purchase order.");
          return;
        }
        const response = await convertProcurementRequestToPurchaseOrder(selectedRequest.id, {
          vendor: convertVendorId,
          warehouse: convertWarehouseId,
          notes: convertNotes.trim()
        });
        toast.success(`${selectedRequest.request_number} converted to ${response.purchase_order.po_number}.`);
        setQueueTab("processing");
        await loadWorkspace({ focusRequestId: selectedRequest.id, focusOrderId: response.purchase_order.id });
        setConvertNotes("");
        return;
      }

      await loadWorkspace({ focusRequestId: selectedRequest.id, focusOrderId: selectedOrder?.id ?? selectedOrderId });
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setActingAction(null);
    }
  };

  const handleOrderAction = async (action: EnterpriseWorkflowAction) => {
    if (!selectedOrder) {
      return;
    }
    setActingAction(action);
    try {
      if (action === "issue") {
        await issueEnterprisePurchaseOrder(selectedOrder.id);
        toast.success(`${selectedOrder.po_number} issued.`);
        setQueueTab("delivery");
      }
      await loadWorkspace({ focusRequestId: selectedRequestId, focusOrderId: selectedOrder.id });
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setActingAction(null);
    }
  };

  const handleApprovalComment = async () => {
    if (!selectedRequest || !approvalComment.trim()) {
      toast.warning("Add a short note before saving it to the approval history.");
      return;
    }
    setActingAction("comment");
    try {
      const response = await addEnterpriseProcurementApprovalComment(selectedRequest.id, approvalComment.trim());
      toast.success(response.message ?? "Approval note saved.");
      setApprovalComment("");
      await loadWorkspace({ focusRequestId: selectedRequest.id, focusOrderId: selectedOrder?.id ?? selectedOrderId });
      setInspectorTab("timeline");
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setActingAction(null);
    }
  };

  const handleAttachmentUpload = async (file: File, attachmentType: string) => {
    if (!selectedRequest) {
      return;
    }
    setIsUploadingAttachment(true);
    try {
      const response = await uploadEnterpriseProcurementAttachment(selectedRequest.id, file, attachmentType);
      toast.success(response.message ?? "Attachment uploaded.");
      await loadWorkspace({ focusRequestId: response.request.id, focusOrderId: selectedOrder?.id ?? selectedOrderId });
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  if (isLoading || !workspace || !financeWorkspace) {
    return <StatePanel variant="loading" title="Loading procurement" message="Loading requests and purchase orders." />;
  }

  if (error) {
    return <StatePanel variant="error" title="Procurement unavailable" message={error} actionLabel="Retry" onAction={() => void loadWorkspace()} />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        <SectionCard
          testId="procurement-workspace-board"
          title="Procurement"
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadCsvFile(
                    buildEnterpriseExportFilename("procurement-workspace"),
                    ["Request", "Department", "Title", "Amount", "Stage", "Needed By", "PO", "Invoice", "Payment"],
                    requestRows.map((row) => [
                      row.request.request_number,
                      row.request.department_name ?? "",
                      row.request.title,
                      row.request.total_amount,
                      row.stage.label,
                      row.request.needed_by_date ?? "",
                      row.order?.po_number ?? "",
                      row.invoice?.invoice_number ?? "",
                      row.payment?.payment_request_number ?? ""
                    ])
                  )
                }
                className="secondary-button inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(true);
                  setSelectedRequestId(null);
                  setSelectedOrderId(null);
                  setApprovalComment("");
                  setConvertNotes("");
                  setQueueTab("review");
                  setInspectorTab("overview");
                  setFormState(buildFormState(null, workspace));
                }}
                className="primary-button inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold"
              >
                <Plus className="h-4 w-4" />
                New Request
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            <WorkspaceTabs tabs={queueTabs} activeTab={queueTab} onChange={setQueueTab} />

            <FilterBar className="mb-0">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search request, justification, department, or PO"
                className="institutional-input rounded-md px-4 py-2.5 outline-none"
              />
              <div className="table-stat flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-[var(--muted)]">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Queue</span>
                {queueTabLabel(queueTab)}
              </div>
              <div className="table-stat flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-[var(--muted)]">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Records</span>
                {filteredRows.length}
              </div>
              <div className="table-stat flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-[var(--muted)]">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Currency</span>
                {currencyCode}
              </div>
            </FilterBar>

            {!filteredRows.length ? (
              <InlineBanner variant="info" title="No requests in this queue" message="Try another queue or create a request." />
            ) : null}

            <DataTable
              columns={[
                { key: "request_number", label: "Request ID", render: (row) => <span className="font-semibold">{row.request.request_number}</span> },
                { key: "department_name", label: "Department", render: (row) => row.request.department_name ?? "Unassigned" },
                {
                  key: "title",
                  label: "Title",
                  render: (row) => (
                    <div className="min-w-[16rem]">
                      <p className="font-semibold text-[var(--ink)]">{row.request.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{row.request.justification || "No justification recorded."}</p>
                    </div>
                  )
                },
                { key: "amount", label: "Amount", render: (row) => formatCurrency(row.request.total_amount, currencyCode) },
                { key: "stage", label: "Stage", render: (row) => stagePill(row.stage) },
                { key: "needed_by_date", label: "Needed By", render: (row) => formatDate(row.request.needed_by_date || row.request.created_at) },
                {
                  key: "linked_record",
                  label: "Linked Record",
                  render: (row) => (
                    <div className="space-y-1 text-xs text-[var(--muted)]">
                      {row.order ? <p>{row.order.po_number}</p> : <p>Not issued</p>}
                      {row.invoice ? <p>{row.invoice.invoice_number}</p> : null}
                      {row.payment ? <p>{row.payment.payment_request_number}</p> : null}
                    </div>
                  )
                },
                {
                  key: "actions",
                  label: "Actions",
                  render: (row) => (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setSelectedRequestId(row.request.id);
                        setSelectedOrderId(row.order?.id ?? null);
                      }}
                      className="primary-button rounded-sm px-3 py-1.5 text-xs font-semibold"
                    >
                      Inspect
                    </button>
                  )
                }
              ]}
              rows={filteredRows}
              emptyMessage="No procurement requests are available in this queue."
            />
          </div>
        </SectionCard>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <DetailSectionCard
          testId="procurement-request-inspector"
          title="Details"
          subtitle={isCreating ? "New Draft" : selectedRequest ? `${selectedRequest.request_number} · ${selectedStage?.label ?? selectedRequest.status_display}` : "No request selected"}
        >
          {formState ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-[var(--surface-low)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Workflow Stage</p>
                  <div className="mt-2">{selectedStage ? stagePill(selectedStage) : stagePill({ key: "draft", label: "Draft", queue: "review", tone: "accent" })}</div>
                </div>
                <div className="rounded-lg bg-[var(--surface-low)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Total (TZS)</p>
                  <p className="mt-2 text-base font-bold text-[var(--ink)]">
                    {formatCurrency(
                      selectedRequest?.total_amount ??
                        formState.lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0),
                      currencyCode
                    )}
                  </p>
                </div>
              </div>

              <WorkspaceTabs
                tabs={[
                  { key: "overview", label: "Overview" },
                  { key: "items", label: "Items", badge: formState.lines.length },
                  { key: "approval", label: "Approval" },
                  { key: "attachments", label: "Files", badge: selectedRequest?.attachments.length ?? 0 },
                  { key: "timeline", label: "History" }
                ]}
                activeTab={inspectorTab}
                onChange={setInspectorTab}
              />

              {inspectorTab === "overview" ? (
                <ProcurementOverviewPanel
                  workspace={workspace}
                  selectedRequest={selectedRequest}
                  selectedOrder={selectedOrder}
                  selectedInvoice={selectedInvoice}
                  selectedPayment={selectedPayment}
                  formState={formState}
                  isCreating={isCreating}
                  isEditingDraft={isEditingDraft}
                  setFormState={setFormState}
                />
              ) : null}

              {inspectorTab === "items" ? (
                <ProcurementItemsPanel
                  workspace={workspace}
                  formState={formState}
                  isEditable={isCreating || isEditingDraft}
                  productsById={productsById}
                  currencyCode={currencyCode}
                  updateLine={updateLine}
                  addLine={addLine}
                  removeLine={removeLine}
                />
              ) : null}

              {inspectorTab === "approval" ? (
                <ProcurementApprovalPanel
                  workspace={workspace}
                  selectedRequest={selectedRequest}
                  selectedOrder={selectedOrder}
                  selectedRequestActions={selectedRequestActions}
                  selectedOrderActions={selectedOrderActions}
                  convertVendorId={convertVendorId}
                  convertWarehouseId={convertWarehouseId}
                  convertNotes={convertNotes}
                  approvalComment={approvalComment}
                  actingAction={actingAction}
                  isCreating={isCreating}
                  isEditingDraft={isEditingDraft}
                  setConvertVendorId={setConvertVendorId}
                  setConvertWarehouseId={setConvertWarehouseId}
                  setConvertNotes={setConvertNotes}
                  setApprovalComment={setApprovalComment}
                  onSaveDraft={saveDraft}
                  onRequestAction={handleRequestAction}
                  onOrderAction={handleOrderAction}
                  onAddApprovalComment={handleApprovalComment}
                  onCancel={() => {
                    setIsCreating(false);
                    setApprovalComment("");
                    setConvertNotes("");
                    setSelectedRequestId(workspace.requests[0]?.id ?? null);
                    setSelectedOrderId(workspace.requests[0]?.purchase_order_id ?? null);
                    setFormState(buildFormState(workspace.requests[0] ?? null, workspace));
                  }}
                />
              ) : null}

              {inspectorTab === "timeline" ? (
                <div className="space-y-5">
                  <EnterpriseTimeline
                    entries={
                      selectedRequest
                        ? selectedRequest.approval_history?.length
                          ? selectedRequest.approval_history
                          : selectedRequest.audit_timeline
                        : []
                    }
                    emptyMessage="Request history will appear here as the workflow progresses."
                  />
                  {selectedOrder ? (
                    <div className="space-y-3 rounded-xl border border-[var(--line)] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Purchase Order Timeline</p>
                      <EnterpriseTimeline entries={selectedOrder.audit_timeline} emptyMessage="Purchase order events will appear here." />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {inspectorTab === "attachments" ? (
                selectedRequest ? (
                  <EnterpriseAttachmentPanel
                    attachments={selectedRequest.attachments}
                    canUpload={canUploadAttachments}
                    isUploading={isUploadingAttachment}
                    uploadLabel="Upload Request Attachment"
                    emptyMessage="No procurement attachments have been uploaded yet."
                    onUpload={handleAttachmentUpload}
                  />
                ) : (
                  <StatePanel variant="empty" title="No attachments" message="Select a request to manage attachments." compact />
                )
              ) : null}
            </div>
          ) : (
            <StatePanel variant="empty" title="No request selected" message="Select a request or create a new one." compact />
          )}
        </DetailSectionCard>
      </aside>
    </div>
  );
}

function ProcurementOverviewPanel({
  workspace,
  selectedRequest,
  selectedOrder,
  selectedInvoice,
  selectedPayment,
  formState,
  isCreating,
  isEditingDraft,
  setFormState
}: {
  workspace: ProcurementWorkspace;
  selectedRequest: ProcurementRequestRecord | null;
  selectedOrder: PurchaseOrderRecord | null;
  selectedInvoice: FinanceInvoiceRecord | null;
  selectedPayment: EnterprisePaymentRequestRecord | null;
  formState: RequestFormState;
  isCreating: boolean;
  isEditingDraft: boolean;
  setFormState: Dispatch<SetStateAction<RequestFormState | null>>;
}) {
  if (isCreating || isEditingDraft) {
    return (
      <div className="space-y-4">
        <label className="grid min-w-0 gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Title</span>
          <input
            value={formState.title}
            onChange={(event) => setFormState((current) => (current ? { ...current, title: event.target.value } : current))}
            className="institutional-input w-full min-w-0 rounded-lg px-3 py-2 outline-none"
          />
        </label>
        <label className="grid min-w-0 gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Justification</span>
          <textarea
            value={formState.justification}
            onChange={(event) => setFormState((current) => (current ? { ...current, justification: event.target.value } : current))}
            rows={3}
            className="institutional-input w-full min-w-0 rounded-xl px-4 py-3 outline-none"
          />
        </label>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="grid min-w-0 gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Department</span>
            <select
              value={formState.department}
              onChange={(event) => setFormState((current) => (current ? { ...current, department: event.target.value } : current))}
              className="institutional-input w-full min-w-0 truncate rounded-lg px-3 py-2 outline-none"
            >
              {workspace.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Budget Link</span>
            <select
              value={formState.budget_account}
              onChange={(event) => setFormState((current) => (current ? { ...current, budget_account: event.target.value } : current))}
              className="institutional-input w-full min-w-0 truncate rounded-lg px-3 py-2 outline-none"
            >
              <option value="">No budget link</option>
              {workspace.budget_accounts.map((budget) => (
                <option key={budget.id} value={budget.id}>
                  {budget.code} · {budget.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Needed By</span>
            <input
              type="date"
              value={formState.needed_by_date}
              onChange={(event) => setFormState((current) => (current ? { ...current, needed_by_date: event.target.value } : current))}
              className="institutional-input w-full min-w-0 rounded-lg px-3 py-2 outline-none"
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="headline-font text-base font-bold tracking-[-0.02em] text-[var(--ink)]">{selectedRequest?.title}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">{selectedRequest?.justification || "No justification recorded."}</p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <InfoCard label="Department" value={selectedRequest?.department_name || "Unassigned"} />
        <InfoCard label="Needed By" value={formatDate(selectedRequest?.needed_by_date || selectedRequest?.created_at)} />
        <InfoCard label="Budget Account" value={selectedRequest?.budget_account_name || "Not linked"} />
        <InfoCard label="Submitted" value={formatDateTime(selectedRequest?.submitted_at || selectedRequest?.created_at)} />
      </div>
      {selectedOrder ? (
        <div className="rounded-lg border border-[var(--line)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Linked Order</p>
          <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{selectedOrder.po_number}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge status={selectedOrder.status_display} />
            {selectedInvoice ? <StatusBadge status={selectedInvoice.status_display} /> : null}
            {selectedPayment ? <StatusBadge status={selectedPayment.status_display} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProcurementItemsPanel({
  workspace,
  formState,
  isEditable,
  productsById,
  currencyCode,
  updateLine,
  addLine,
  removeLine
}: {
  workspace: ProcurementWorkspace;
  formState: RequestFormState;
  isEditable: boolean;
  productsById: Map<string, EnterpriseProduct>;
  currencyCode: string;
  updateLine: (index: number, patch: Partial<RequestLineForm>) => void;
  addLine: () => void;
  removeLine: (index: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Line Items</p>
        {isEditable ? (
          <button type="button" onClick={addLine} className="secondary-button rounded-sm px-3 py-1.5 text-xs font-semibold">
            Add Line
          </button>
        ) : null}
      </div>
      {formState.lines.map((line, index) => {
        const linkedProduct = line.product ? productsById.get(line.product) : null;
        const lineTotal = Number(line.quantity || 0) * Number(line.unit_price || 0);
        return (
          <div key={`procurement-line-${index}`} className="rounded-lg border border-[var(--line)] p-3">
            <div className="grid gap-3">
              <select
                value={line.product}
                onChange={(event) => {
                  const nextProduct = productsById.get(event.target.value);
                  updateLine(index, {
                    product: event.target.value,
                    description: nextProduct?.name ?? line.description,
                    unit_of_measure: nextProduct?.unit_of_measure ?? line.unit_of_measure,
                    unit_price: nextProduct ? String(nextProduct.standard_cost) : line.unit_price
                  });
                }}
                disabled={!isEditable}
                className="institutional-input rounded-lg px-3 py-2.5 outline-none"
              >
                <option value="">Manual item</option>
                {workspace.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name}
                  </option>
                ))}
              </select>
              <input
                value={line.description}
                onChange={(event) => updateLine(index, { description: event.target.value })}
                placeholder="Line description"
                disabled={!isEditable}
                className="institutional-input rounded-lg px-3 py-2.5 outline-none"
              />
              <div className="grid gap-3 xl:grid-cols-3">
                <input
                  value={line.unit_of_measure}
                  onChange={(event) => updateLine(index, { unit_of_measure: event.target.value })}
                  placeholder="Unit"
                  disabled={!isEditable}
                  className="institutional-input rounded-lg px-3 py-2.5 outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.quantity}
                  onChange={(event) => updateLine(index, { quantity: event.target.value })}
                  disabled={!isEditable}
                  className="institutional-input rounded-lg px-3 py-2.5 outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unit_price}
                  onChange={(event) => updateLine(index, { unit_price: event.target.value })}
                  disabled={!isEditable}
                  className="institutional-input rounded-lg px-3 py-2.5 outline-none"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
              <span>{linkedProduct ? `${linkedProduct.sku} · ${linkedProduct.name}` : "Manual line"}</span>
              <span className="font-semibold text-[var(--ink)]">{formatCurrency(lineTotal, currencyCode)}</span>
            </div>
            {isEditable && formState.lines.length > 1 ? (
              <button type="button" onClick={() => removeLine(index)} className="mt-3 text-xs font-semibold text-[var(--danger)]">
                Remove line
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ProcurementApprovalPanel({
  workspace,
  selectedRequest,
  selectedOrder,
  selectedRequestActions,
  selectedOrderActions,
  convertVendorId,
  convertWarehouseId,
  convertNotes,
  approvalComment,
  actingAction,
  isCreating,
  isEditingDraft,
  setConvertVendorId,
  setConvertWarehouseId,
  setConvertNotes,
  setApprovalComment,
  onSaveDraft,
  onRequestAction,
  onOrderAction,
  onAddApprovalComment,
  onCancel
}: {
  workspace: ProcurementWorkspace;
  selectedRequest: ProcurementRequestRecord | null;
  selectedOrder: PurchaseOrderRecord | null;
  selectedRequestActions: EnterpriseWorkflowAction[];
  selectedOrderActions: EnterpriseWorkflowAction[];
  convertVendorId: string;
  convertWarehouseId: string;
  convertNotes: string;
  approvalComment: string;
  actingAction: string | null;
  isCreating: boolean;
  isEditingDraft: boolean;
  setConvertVendorId: Dispatch<SetStateAction<string>>;
  setConvertWarehouseId: Dispatch<SetStateAction<string>>;
  setConvertNotes: Dispatch<SetStateAction<string>>;
  setApprovalComment: Dispatch<SetStateAction<string>>;
  onSaveDraft: (submitAfterSave: boolean) => Promise<void>;
  onRequestAction: (action: EnterpriseWorkflowAction) => Promise<void>;
  onOrderAction: (action: EnterpriseWorkflowAction) => Promise<void>;
  onAddApprovalComment: () => Promise<void>;
  onCancel: () => void;
}) {
  if (isCreating || isEditingDraft) {
    return (
      <div className="space-y-4">
        <InlineBanner variant="info" title="Draft" message="Save changes or submit for review." />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onCancel} disabled={Boolean(actingAction)} className="secondary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSaveDraft(false)}
            disabled={Boolean(actingAction)}
            className="secondary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {actingAction === "edit" ? "Saving..." : isCreating ? "Create Draft" : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={() => void onSaveDraft(true)}
            disabled={Boolean(actingAction)}
            className="primary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {actingAction === "submit" ? "Submitting..." : "Save and Submit"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WorkflowActionBar
        actions={selectedRequestActions}
        busyAction={actingAction && actingAction !== "comment" ? (actingAction as EnterpriseWorkflowAction) : null}
        testIdPrefix="procurement-request-action"
        onAction={(action) => void onRequestAction(action)}
        emptyMessage="No request actions are available in the current state."
      />

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Decision Note</label>
        <textarea
          value={approvalComment}
          onChange={(event) => setApprovalComment(event.target.value)}
          rows={2}
          placeholder="Add an approval note, correction request, or rejection reason."
          className="institutional-input w-full rounded-xl px-4 py-3 outline-none"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void onAddApprovalComment()}
            disabled={actingAction === "comment" || !approvalComment.trim()}
            className="secondary-button rounded-sm px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {actingAction === "comment" ? "Saving..." : "Save Note"}
          </button>
        </div>
      </div>

      {selectedRequestActions.includes("convert_to_purchase_order") ? (
        <div className="rounded-lg border border-[var(--line)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Order Setup</p>
          <div className="mt-3 grid gap-3">
            <select value={convertVendorId} onChange={(event) => setConvertVendorId(event.target.value)} className="institutional-input rounded-xl px-4 py-3 outline-none">
              <option value="">Select vendor</option>
              {workspace.vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
            <select
              value={convertWarehouseId}
              onChange={(event) => setConvertWarehouseId(event.target.value)}
              className="institutional-input rounded-xl px-4 py-3 outline-none"
            >
              <option value="">Select warehouse</option>
              {workspace.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <textarea
              value={convertNotes}
              onChange={(event) => setConvertNotes(event.target.value)}
              rows={3}
              placeholder="Notes for the issued purchase order"
              className="institutional-input rounded-xl px-4 py-3 outline-none"
            />
          </div>
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="space-y-3 rounded-lg border border-[var(--line)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Order Fulfillment</p>
          <p className="text-sm font-semibold text-[var(--ink)]">{selectedOrder.po_number}</p>
          <WorkflowActionBar
            actions={selectedOrderActions}
            busyAction={actingAction && actingAction !== "comment" ? (actingAction as EnterpriseWorkflowAction) : null}
            testIdPrefix="purchase-order-action"
            onAction={(action) => void onOrderAction(action)}
            emptyMessage="No procurement-side order actions remain on this purchase order."
          />
        </div>
      ) : null}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}
