import type { RequestRecord } from "../types";

export type RequestActionVisibility = {
  showSaveDraft: boolean;
  showSubmit: boolean;
  showStartReview: boolean;
  showApprove: boolean;
  showReject: boolean;
  showRecordPayment: boolean;
  showAddPayment: boolean;
  showMarkCompleted: boolean;
  showCancel: boolean;
  showRestore: boolean;
  showReverse: boolean;
  isFinal: boolean;
};

export function getRequestActionVisibility(status: string): RequestActionVisibility {
  const normalized = (status || "").toLowerCase();

  if (normalized === "draft") {
    return {
      showSaveDraft: true,
      showSubmit: true,
      showStartReview: false,
      showApprove: false,
      showReject: false,
      showRecordPayment: false,
      showAddPayment: false,
      showMarkCompleted: false,
      showCancel: true,
      showRestore: false,
      showReverse: false,
      isFinal: false
    };
  }

  if (normalized === "pending") {
    return {
      showSaveDraft: false,
      showSubmit: false,
      showStartReview: true,
      showApprove: false,
      showReject: false,
      showRecordPayment: false,
      showAddPayment: false,
      showMarkCompleted: false,
      showCancel: true,
      showRestore: false,
      showReverse: false,
      isFinal: false
    };
  }

  if (normalized === "under_review") {
    return {
      showSaveDraft: false,
      showSubmit: false,
      showStartReview: false,
      showApprove: true,
      showReject: true,
      showRecordPayment: false,
      showAddPayment: false,
      showMarkCompleted: false,
      showCancel: true,
      showRestore: false,
      showReverse: false,
      isFinal: false
    };
  }

  if (normalized === "approved") {
    return {
      showSaveDraft: false,
      showSubmit: false,
      showStartReview: false,
      showApprove: false,
      showReject: false,
      showRecordPayment: true,
      showAddPayment: false,
      showMarkCompleted: false,
      showCancel: true,
      showRestore: false,
      showReverse: true,
      isFinal: false
    };
  }

  if (normalized === "partially_paid") {
    return {
      showSaveDraft: false,
      showSubmit: false,
      showStartReview: false,
      showApprove: false,
      showReject: false,
      showRecordPayment: false,
      showAddPayment: true,
      showMarkCompleted: true,
      showCancel: true,
      showRestore: false,
      showReverse: false,
      isFinal: false
    };
  }

  if (normalized === "cancelled" || normalized === "archived") {
    return {
      showSaveDraft: false,
      showSubmit: false,
      showStartReview: false,
      showApprove: false,
      showReject: false,
      showRecordPayment: false,
      showAddPayment: false,
      showMarkCompleted: false,
      showCancel: false,
      showRestore: true,
      showReverse: false,
      isFinal: true
    };
  }

  if (normalized === "rejected") {
    return {
      showSaveDraft: false,
      showSubmit: false,
      showStartReview: false,
      showApprove: false,
      showReject: false,
      showRecordPayment: false,
      showAddPayment: false,
      showMarkCompleted: false,
      showCancel: false,
      showRestore: false,
      showReverse: true,
      isFinal: true
    };
  }

  if (normalized === "paid") {
    return {
      showSaveDraft: false,
      showSubmit: false,
      showStartReview: false,
      showApprove: false,
      showReject: false,
      showRecordPayment: false,
      showAddPayment: false,
      showMarkCompleted: false,
      showCancel: false,
      showRestore: false,
      showReverse: false,
      isFinal: true
    };
  }

  return {
    showSaveDraft: false,
    showSubmit: false,
    showStartReview: false,
    showApprove: false,
    showReject: false,
    showRecordPayment: false,
    showAddPayment: false,
    showMarkCompleted: false,
    showCancel: false,
    showRestore: false,
    showReverse: false,
    isFinal: false
  };
}

export type PaymentLifecycleState =
  | "Not Started"
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
