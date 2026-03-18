import { describe, expect, it } from "vitest";
import { getPaymentLifecycleState, getRequestActionVisibility, resolveUserLifecycleState } from "./workflowMatrix";

describe("getRequestActionVisibility", () => {
  it("shows save draft + submit for draft", () => {
    const state = getRequestActionVisibility("draft");
    expect(state.showSaveDraft).toBe(true);
    expect(state.showSubmit).toBe(true);
    expect(state.showApprove).toBe(false);
  });

  it("shows approve/reject only for under review", () => {
    const state = getRequestActionVisibility("under_review");
    expect(state.showApprove).toBe(true);
    expect(state.showReject).toBe(true);
    expect(state.showRecordPayment).toBe(false);
  });

  it("shows add payment + mark completed for partially paid", () => {
    const state = getRequestActionVisibility("partially_paid");
    expect(state.showAddPayment).toBe(true);
    expect(state.showMarkCompleted).toBe(true);
    expect(state.showRecordPayment).toBe(false);
  });

  it("shows revert plus valid next-stage actions for approved", () => {
    const state = getRequestActionVisibility("approved");
    expect(state.showRecordPayment).toBe(true);
    expect(state.showReverse).toBe(true);
    expect(state.showApprove).toBe(false);
    expect(state.showReject).toBe(false);
  });

  it("shows revert only for rejected decision state", () => {
    const state = getRequestActionVisibility("rejected");
    expect(state.showReverse).toBe(true);
    expect(state.showRecordPayment).toBe(false);
    expect(state.showApprove).toBe(false);
    expect(state.showReject).toBe(false);
  });

  it("hides workflow actions for paid", () => {
    const state = getRequestActionVisibility("paid");
    expect(state.showApprove).toBe(false);
    expect(state.showReject).toBe(false);
    expect(state.showRecordPayment).toBe(false);
    expect(state.isFinal).toBe(true);
  });
});

describe("getPaymentLifecycleState", () => {
  it("returns pending entry for approved request", () => {
    const state = getPaymentLifecycleState({
      status: "approved",
      approved_amount: 1000,
      disbursed_amount: 0
    } as never);
    expect(state).toBe("Pending Entry");
  });

  it("returns partially paid for partial disbursement", () => {
    const state = getPaymentLifecycleState({
      status: "partially_paid",
      approved_amount: 1000,
      disbursed_amount: 400
    } as never);
    expect(state).toBe("Partially Paid");
  });
});

describe("resolveUserLifecycleState", () => {
  it("resolves locked users", () => {
    const state = resolveUserLifecycleState({
      is_active: true,
      is_archived: false,
      is_active_staff: false
    });
    expect(state).toBe("locked");
  });

  it("resolves archived users first", () => {
    const state = resolveUserLifecycleState({
      is_active: true,
      is_archived: true,
      is_active_staff: true
    });
    expect(state).toBe("archived");
  });
});
