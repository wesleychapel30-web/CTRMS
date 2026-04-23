import { Download } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { DetailSectionCard } from "../components/DetailSectionCard";
import { EnterpriseAttachmentPanel } from "../components/EnterpriseAttachmentPanel";
import { EnterpriseTimeline } from "../components/EnterpriseTimeline";
import { InlineBanner, StatePanel } from "../components/FeedbackStates";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { WorkspaceTabs } from "../components/WorkspaceTabs";
import { WorkflowActionBar } from "../components/WorkflowActionBar";
import { useSession } from "../context/SessionContext";
import { useToast } from "../context/ToastContext";
import { fetchInventoryWorkspace, receiveEnterprisePurchaseOrder, uploadEnterpriseGoodsReceiptAttachment } from "../lib/api";
import { buildEnterpriseExportFilename, downloadCsvFile } from "../lib/enterpriseWorkflow";
import { formatCurrency, formatDateTime } from "../lib/format";
import type { GoodsReceiptRecord, InventoryWorkspace, PurchaseOrderRecord, Stat } from "../types";

type ReceiptFormState = {
  warehouse: string;
  notes: string;
  quantities: Record<string, string>;
};
type InspectorTab = "receiving" | "details" | "attachments" | "timeline";

function buildReceiptFormState(order: PurchaseOrderRecord | null) {
  return {
    warehouse: order?.warehouse ?? "",
    notes: "",
    quantities: Object.fromEntries((order?.lines ?? []).map((line) => [line.id, String(line.outstanding_quantity > 0 ? line.outstanding_quantity : 0)]))
  };
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unable to complete the receiving action";
}

export function InventoryPage() {
  const { hasAnyPermission } = useSession();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [workspace, setWorkspace] = useState<InventoryWorkspace | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ReceiptFormState | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("receiving");
  const [actingAction, setActingAction] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = async (options?: { focusOrderId?: string | null; focusReceiptId?: string | null }) => {
    setIsLoading(true);
    try {
      const payload = await fetchInventoryWorkspace();
      const focusOrderId = options?.focusOrderId ?? searchParams.get("order") ?? selectedOrderId ?? payload.receivable_orders[0]?.id ?? null;
      const focusReceiptId = options?.focusReceiptId ?? searchParams.get("receipt") ?? selectedReceiptId ?? null;
      setWorkspace(payload);
      setSelectedOrderId(focusOrderId);
      setSelectedReceiptId(focusReceiptId);
      setError(null);
      const order = payload.receivable_orders.find((item) => item.id === focusOrderId) ?? null;
      setFormState(buildReceiptFormState(order));
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const selectedOrder = selectedOrderId
    ? workspace?.receivable_orders.find((item) => item.id === selectedOrderId) ?? null
    : workspace?.receivable_orders[0] ?? null;
  const selectedReceipt = selectedReceiptId
    ? workspace?.receipts.find((item) => item.id === selectedReceiptId) ?? null
    : null;
  const currencyCode = workspace?.organization?.currency_code ?? "TZS";
  const canUploadReceiptAttachments = hasAnyPermission(["goods_receipt:record"]);

  // Determine which timeline to show in the inspector
  const inspectorTimeline = selectedReceipt?.audit_timeline ?? selectedOrder?.audit_timeline ?? [];

  // Placeholder for inventory specific filters
  const [inventoryQueueTab, setInventoryQueueTab] = useState("receivable");
  useEffect(() => {
    setFormState(buildReceiptFormState(selectedOrder));
  }, [selectedOrderId, workspace?.receivable_orders]);

  const stats: Stat[] = [
    { label: "Warehouses", value: String(workspace?.summary.warehouses ?? 0), change: "Active storage nodes", tone: "accent" },
    { label: "Receivable Orders", value: String(workspace?.summary.receivable_orders ?? 0), change: "Ready for goods receipt", tone: "warning" },
    { label: "Receipts Posted", value: String(workspace?.summary.receipts_posted ?? 0), change: "Inventory updated", tone: "success" },
    { label: "Stock Alerts", value: String(workspace?.summary.stock_alerts ?? 0), change: "Below reorder level", tone: "danger" }
  ];

  const validateReceipt = () => {
    if (!selectedOrder || !formState) {
      return "Select a purchase order to record a receipt.";
    }
    const hasQuantity = selectedOrder.lines.some((line) => Number(formState.quantities[line.id] ?? 0) > 0);
    if (!hasQuantity) {
      return "Enter at least one received quantity greater than zero.";
    }
    for (const line of selectedOrder.lines) {
      const quantity = Number(formState.quantities[line.id] ?? 0);
      if (quantity < 0) {
        return "Received quantities cannot be negative.";
      }
      if (quantity > Number(line.outstanding_quantity)) {
        return `Received quantity for ${line.description} exceeds the outstanding balance.`;
      }
    }
    return null;
  };

  const handleReceive = async () => {
    if (!selectedOrder || !formState) {
      return;
    }
    const validationError = validateReceipt();
    if (validationError) {
      toast.warning(validationError);
      return;
    }
    setActingAction("record_goods_receipt");
    try {
      const response = await receiveEnterprisePurchaseOrder(selectedOrder.id, {
        warehouse: formState.warehouse || null,
        notes: formState.notes.trim(),
        lines: selectedOrder.lines
          .map((line) => ({
            purchase_order_line: line.id,
            quantity_received: Number(formState.quantities[line.id] ?? 0)
          }))
          .filter((line) => line.quantity_received > 0)
      });
      toast.success(`${response.goods_receipt.receipt_number} posted to inventory.`);
      await loadWorkspace({ focusOrderId: selectedOrder.id, focusReceiptId: response.goods_receipt.id });
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setActingAction(null);
    }
  };

  const handleReceiptAttachmentUpload = async (file: File, attachmentType: string) => {
    if (!selectedReceipt) {
      return;
    }
    setIsUploadingAttachment(true);
    try {
      const response = await uploadEnterpriseGoodsReceiptAttachment(selectedReceipt.id, file, attachmentType);
      toast.success(response.message ?? "Attachment uploaded.");
      await loadWorkspace({ focusOrderId: selectedOrderId, focusReceiptId: response.goods_receipt.id });
    } catch (reason) {
      toast.error(getErrorMessage(reason));
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  if (isLoading || !workspace) {
    return <StatePanel variant="loading" title="Loading inventory" message="Loading receipts and stock records." />;
  }

  if (error) {
    return <StatePanel variant="error" title="Inventory unavailable" message={error} actionLabel="Retry" onAction={() => void loadWorkspace()} />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={stat.label} className={`item-enter item-enter-${index + 1}`}>
              <StatCard {...stat} />
            </div>
          ))}
        </div>

        <SectionCard
          testId="inventory-receivable-orders-section"
          title="Purchase Orders"
          subtitle="Orders ready for receiving."
          action={
            <button
              type="button"
              onClick={() =>
                downloadCsvFile(
                  buildEnterpriseExportFilename("receivable-purchase-orders"),
                  ["PO", "Request", "Vendor", "Warehouse", "Status", "Total"],
                  workspace.receivable_orders.map((item) => [
                    item.po_number,
                    item.procurement_request_number ?? "",
                    item.vendor_name ?? "",
                    item.warehouse_name ?? "",
                    item.status_display,
                    item.total_amount
                  ])
                )
              }
              className="secondary-button inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          }
        >
          <DataTable
            columns={[
              { key: "po_number", label: "PO", render: (row) => <span className="font-semibold">{row.po_number}</span> },
              { key: "vendor_name", label: "Vendor" },
              { key: "warehouse_name", label: "Warehouse" },
              { key: "status_display", label: "Status", render: (row) => <StatusBadge status={row.status_display} /> },
              { key: "total_amount", label: "Total", render: (row) => formatCurrency(row.total_amount, currencyCode) },
              {
                key: "actions",
                label: "Focus",
                render: (row) => (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderId(row.id);
                      setSelectedReceiptId(null);
                    }}
                    aria-label={`Receive against purchase order ${row.po_number}`}
                    className="primary-button rounded-sm px-3 py-1.5 text-xs font-semibold"
                  >
                    Receive
                  </button>
                )
              }
            ]}
            rows={workspace.receivable_orders}
            emptyMessage="No issued purchase orders are waiting for receiving."
          />
        </SectionCard>

        <SectionCard
          testId="inventory-receipts-section"
          title="Goods Receipts"
          subtitle="Recorded receipts."
          action={
            <button
              type="button"
              onClick={() =>
                downloadCsvFile(
                  buildEnterpriseExportFilename("goods-receipts"),
                  ["Receipt", "PO", "Warehouse", "Received", "Status"],
                  workspace.receipts.map((item) => [
                    item.receipt_number,
                    item.purchase_order_number ?? "",
                    item.warehouse_name ?? "",
                    item.received_at,
                    item.status
                  ])
                )
              }
              className="secondary-button inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          }
        >
          <DataTable
            columns={[
              { key: "receipt_number", label: "Receipt", render: (row) => <span className="font-semibold">{row.receipt_number}</span> },
              { key: "purchase_order_number", label: "PO" },
              { key: "warehouse_name", label: "Warehouse" },
              { key: "received_at", label: "Received", render: (row) => formatDateTime(row.received_at) },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
              {
                key: "actions",
                label: "Focus",
                render: (row) => (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReceiptId(row.id);
                      setSelectedOrderId(row.purchase_order);
                    }}
                    aria-label={`Inspect goods receipt ${row.receipt_number}`}
                    className="secondary-button rounded-sm px-3 py-1.5 text-xs font-semibold"
                  >
                    Inspect
                  </button>
                )
              }
            ]}
            rows={workspace.receipts}
            emptyMessage="No goods receipts have been recorded."
          />
        </SectionCard>

        <SectionCard testId="inventory-ledger-section" title="Inventory Ledger" subtitle="Stock movements.">
          <DataTable
            columns={[
              { key: "reference_number", label: "Reference", render: (row) => <span className="font-semibold">{row.reference_number}</span> },
              { key: "product_name", label: "Product" },
              { key: "warehouse_name", label: "Warehouse" },
              { key: "quantity", label: "Quantity" },
              { key: "movement_type_display", label: "Movement" },
              { key: "occurred_at", label: "Occurred", render: (row) => formatDateTime(row.occurred_at) }
            ]}
            rows={workspace.ledger}
            emptyMessage="No inventory ledger movement has been recorded yet."
          />
        </SectionCard>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-[5.25rem] xl:max-h-[calc(100vh-6.75rem)] xl:overflow-y-auto">
        <DetailSectionCard testId="inventory-receiving-workbench" title="Receiving" subtitle={selectedOrder?.po_number ?? "No order selected"}>
          <ReceivingWorkbench
            workspace={workspace}
            selectedOrder={selectedOrder}
            formState={formState}
            actingAction={actingAction}
            currencyCode={currencyCode}
            setFormState={setFormState}
            onReceive={handleReceive}
          />
        </DetailSectionCard>

        <DetailSectionCard testId="inventory-receipt-impact" title="Receipt Impact" subtitle={selectedReceipt?.receipt_number ?? "No receipt selected"}>
          {selectedReceipt ? (
            <ReceiptImpact receipt={selectedReceipt} />
          ) : (
            <p className="text-sm text-[var(--muted)]">Select a posted receipt to review the stock impact and audit history.</p>
          )}
        </DetailSectionCard>

        <DetailSectionCard testId="inventory-receipt-attachments" title="Receipt Attachments" subtitle={selectedReceipt?.receipt_number ?? "No receipt selected"}>
          {selectedReceipt ? (
            <EnterpriseAttachmentPanel
              attachments={selectedReceipt.attachments}
              canUpload={canUploadReceiptAttachments}
              isUploading={isUploadingAttachment}
              uploadLabel="Upload Receipt Attachment"
              emptyMessage="No receipt attachments have been uploaded yet."
              onUpload={handleReceiptAttachmentUpload}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">Select a goods receipt to review or upload attachments.</p>
          )}
        </DetailSectionCard>
      </aside>
    </div>
  );
}

function ReceivingWorkbench({
  workspace,
  selectedOrder,
  formState,
  actingAction,
  currencyCode,
  setFormState,
  onReceive
}: {
  workspace: InventoryWorkspace;
  selectedOrder: PurchaseOrderRecord | null;
  formState: ReceiptFormState | null;
  actingAction: string | null;
  currencyCode: string;
  setFormState: Dispatch<SetStateAction<ReceiptFormState | null>>;
  onReceive: () => Promise<void>;
}) {
  if (!selectedOrder || !formState) {
    return <StatePanel variant="empty" title="No order selected" message="Select a purchase order to receive." compact />;
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-[var(--surface-container)] bg-[var(--surface-low)] px-4 py-3 text-sm text-[var(--muted)]">
        Record the quantities received to update stock.
      </p>
      <div className="rounded-xl bg-[var(--surface-low)] p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Warehouse</p>
        <select
          value={formState.warehouse}
          onChange={(event) => setFormState((current) => (current ? { ...current, warehouse: event.target.value } : current))}
          aria-label="Receiving warehouse"
          className="institutional-input mt-3 w-full rounded-xl px-4 py-3 outline-none"
        >
          {workspace.warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </div>
      <WorkflowActionBar
        actions={selectedOrder.available_actions}
        busyAction={actingAction as never}
        testIdPrefix="inventory-order-action"
        onAction={(action) => {
          if (action === "record_goods_receipt") {
            void onReceive();
          }
        }}
        emptyMessage="No receiving action is available on this order."
      />
      <div className="space-y-3">
        {selectedOrder.lines.map((line) => (
          <div key={line.id} className="rounded-xl border border-[var(--surface-container)] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">{line.description}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Ordered {line.quantity_ordered} {line.unit_of_measure} · Outstanding {line.outstanding_quantity}
                </p>
              </div>
              <p className="text-xs font-semibold text-[var(--muted)]">{formatCurrency(line.line_total, currencyCode)}</p>
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formState.quantities[line.id] ?? "0"}
              onChange={(event) =>
                setFormState((current) =>
                  current
                    ? {
                        ...current,
                        quantities: {
                          ...current.quantities,
                          [line.id]: event.target.value
                        }
                      }
                    : current
                )
              }
              aria-label={`Received quantity for ${line.description}`}
              className="institutional-input mt-3 w-full rounded-xl px-4 py-3 outline-none"
            />
          </div>
        ))}
      </div>
      <textarea
        value={formState.notes}
        onChange={(event) => setFormState((current) => (current ? { ...current, notes: event.target.value } : current))}
        rows={3}
        placeholder="Receiving notes"
        aria-label="Receiving notes"
        className="institutional-input w-full rounded-xl px-4 py-3 outline-none"
      />
      <EnterpriseTimeline entries={selectedOrder.audit_timeline} emptyMessage="Purchase order events will appear here." />
    </div>
  );
}

function ReceiptImpact({ receipt }: { receipt: GoodsReceiptRecord }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[var(--surface-low)] p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Warehouse</p>
        <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{receipt.warehouse_name}</p>
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Received Lines</p>
        {receipt.lines.map((line) => (
          <div key={line.id} className="rounded-xl border border-[var(--surface-container)] p-3">
            <p className="text-sm font-semibold text-[var(--ink)]">{line.product_name}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Quantity received: {line.quantity_received}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Ledger Impact</p>
        {receipt.ledger_entries.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-[var(--surface-container)] p-3">
            <p className="text-sm font-semibold text-[var(--ink)]">{entry.product_name}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {entry.quantity} into {entry.warehouse_name} via {entry.reference_number}
            </p>
          </div>
        ))}
      </div>
      <EnterpriseTimeline entries={receipt.audit_timeline} emptyMessage="Goods receipt events will appear here." />
    </div>
  );
}
