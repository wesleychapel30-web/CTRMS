import { formatEnterpriseActionLabel } from "../lib/enterpriseWorkflow";
import type { EnterpriseWorkflowAction } from "../types";

type WorkflowActionBarProps = {
  actions: EnterpriseWorkflowAction[];
  busyAction?: EnterpriseWorkflowAction | null;
  onAction: (action: EnterpriseWorkflowAction) => void;
  emptyMessage?: string;
  testIdPrefix?: string;
};

const destructiveActions = new Set<EnterpriseWorkflowAction>(["reject"]);
const primaryActions = new Set<EnterpriseWorkflowAction>([
  "submit",
  "approve",
  "convert_to_purchase_order",
  "issue",
  "record_goods_receipt",
  "post",
  "create_payment_request",
  "mark_paid"
]);

export function WorkflowActionBar({
  actions,
  busyAction = null,
  onAction,
  emptyMessage = "No workflow actions are available for this record right now.",
  testIdPrefix = "workflow-action"
}: WorkflowActionBarProps) {
  if (!actions.length) {
    return <p className="text-sm text-[var(--muted)]">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const isBusy = busyAction === action;
        const isPrimary = primaryActions.has(action);
        const isDestructive = destructiveActions.has(action);
        const toneClass = isDestructive
          ? "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
          : isPrimary
            ? "primary-button"
            : "secondary-button";

        return (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action)}
            disabled={Boolean(busyAction)}
            data-testid={`${testIdPrefix}-${action}`}
            aria-label={formatEnterpriseActionLabel(action)}
            className={`interactive-press rounded-sm px-3 py-2 text-xs font-semibold ${toneClass} disabled:opacity-60`}
          >
            {isBusy ? "Working..." : formatEnterpriseActionLabel(action)}
          </button>
        );
      })}
    </div>
  );
}
