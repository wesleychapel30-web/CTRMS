import type { RequestRecord } from "../types";

export type RequestActionVisibility = {
  showSaveDraft: boolean;
  showSubmit: boolean;
  showStartReview: boolean;
  showApprove: boolean;
  showReject: boolean;
  showRequestClarification: boolean;
  showFinanceStartProcessing: boolean;
  showFinanceRaiseQuery: boolean;
  showFinancePendingPayment: boolean;
  showRecordPayment: boolean;
  showAddPayment: boolean;
  showMarkCompleted: boolean;
  showCancel: boolean;
  showRestore: boolean;
  showReverse: boolean;
  isFinal: boolean;
};

const NO_ACTIONS: RequestActionVisibility = {
  showSaveDraft: false,
  showSubmit: false,
  showStartReview: false,
  showApprove: false,
  showReject: false,
  showRequestClarification: false,
  showFinanceStartProcessing: false,
  showFinanceRaiseQuery: false,
  showFinancePendingPayment: false,
  showRecordPayment: false,
  showAddPayment: false,
  showMarkCompleted: false,
  showCancel: false,
  showRestore: false,
  showReverse: false,
  isFinal: false,
};

export function getRequestActionVisibility(status: string): RequestActionVisibility {
  const normalized = (status || "").toLowerCase();

  if (normalized === "draft") {
    return {
      ...NO_ACTIONS,
      showSaveDraft: true,
      showSubmit: true,
      showCancel: true,
    };
  }

  if (normalized === "pending") {
    return {
      ...NO_ACTIONS,
      showStartReview: true,
      showCancel: true,
    };
  }

  if (normalized === "under_review") {
    return {
      ...NO_ACTIONS,
      showApprove: true,
      showReject: true,
      showRequestClarification: true,
      showCancel: true,
    };
  }

  if (normalized === "needs_clarification") {
    return {
      ...NO_ACTIONS,
      showSaveDraft: true,
      showSubmit: true,
      showCancel: true,
    };
  }

  if (normalized === "director_approved") {
    return {
      ...NO_ACTIONS,
      showFinanceStartProcessing: true,
      showReverse: true,
      showCancel: true,
    };
  }

  if (normalized === "director_rejected") {
    return {
      ...NO_ACTIONS,
      showReverse: true,
      isFinal: true,
    };
  }

  if (normalized === "finance_processing") {
    return {
      ...NO_ACTIONS,
      showFinanceRaiseQuery: true,
      showFinancePendingPayment: true,
      showCancel: true,
    };
  }

  if (normalized === "finance_query") {
    return {
      ...NO_ACTIONS,
      showFinanceStartProcessing: true,
      showCancel: true,
    };
  }

  if (normalized === "pending_payment") {
    return {
      ...NO_ACTIONS,
      showRecordPayment: true,
      showCancel: true,
    };
  }

  // Legacy: inventory route final approval OR pre-new-workflow funded requests
  if (normalized === "approved") {
    return {
      ...NO_ACTIONS,
      showRecordPayment: true,
      showCancel: true,
      showReverse: true,
    };
  }

  if (normalized === "partially_paid") {
    return {
      ...NO_ACTIONS,
      showAddPayment: true,
      showMarkCompleted: true,
      showCancel: true,
    };
  }

  if (normalized === "cancelled" || normalized === "archived") {
    return {
      ...NO_ACTIONS,
      showRestore: true,
      isFinal: true,
    };
  }

  if (normalized === "rejected") {
    return {
      ...NO_ACTIONS,
      showReverse: true,
      isFinal: true,
    };
  }

  if (normalized === "paid") {
    return {
      ...NO_ACTIONS,
      isFinal: true,
    };
  }

  return { ...NO_ACTIONS };
}

export type PaymentLifecycleState =
  | "Not Started"
  | "Director Approved"
  | "Finance Processing"
  | "Finance Query"
  | "Pending Payment"
  | "Pending Entry"
  | "Partially Paid"
  | "Fully Paid"
  | "Reversed"
  | "Cancelled";

export function getPaymentLifecycleState(record: RequestRecord): PaymentLifecycleState {
  const status = (record.status || "").toLowerCase();
  const approvedAmount = Number(record.approved_amount ?? 0);
  const disbursedAmount = Number(record.disbursed_amount ?? 0);

  if (status === "cancelled" || status === "archived") {
    return "Cancelled";
  }
  if (status === "paid") {
    return "Fully Paid";
  }
  if (status === "partially_paid") {
    return "Partially Paid";
  }
  if (status === "pending_payment") {
    return "Pending Payment";
  }
  if (status === "finance_query") {
    return "Finance Query";
  }
  if (status === "finance_processing") {
    return "Finance Processing";
  }
  if (status === "director_approved") {
    return "Director Approved";
  }
  if (status === "approved") {
    if (approvedAmount > 0 && disbursedAmount > 0 && disbursedAmount < approvedAmount) {
      return "Partially Paid";
    }
    return "Pending Entry";
  }
  if (status === "under_review") {
    return "Reversed";
  }
  return "Not Started";
}

export type UserLifecycleState = "active" | "inactive" | "archived" | "locked";

export function resolveUserLifecycleState(user: {
  is_active?: boolean;
  is_archived?: boolean;
  is_active_staff?: boolean;
}): UserLifecycleState {
  if (Boolean(user.is_archived)) {
    return "archived";
  }
  if (!Boolean(user.is_active)) {
    return "inactive";
  }
  if (user.is_active_staff === false) {
    return "locked";
  }
  return "active";
}
