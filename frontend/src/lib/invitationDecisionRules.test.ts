import { describe, expect, it } from "vitest";
import { getInvitationDecisionVisibility } from "./invitationDecisionRules";

describe("getInvitationDecisionVisibility", () => {
  it("shows Accept/Decline only for pending review", () => {
    const state = getInvitationDecisionVisibility("pending_review");
    expect(state).toEqual({
      showAccept: true,
      showDecline: true,
      showConfirm: false,
      showRevert: false,
      isFinal: false
    });
  });

  it("shows Confirm only for accepted", () => {
    const state = getInvitationDecisionVisibility("accepted");
    expect(state).toEqual({
      showAccept: false,
      showDecline: false,
      showConfirm: true,
      showRevert: true,
      isFinal: false
    });
  });

  it("hides all actions for declined", () => {
    const state = getInvitationDecisionVisibility("declined");
    expect(state).toEqual({
      showAccept: false,
      showDecline: false,
      showConfirm: false,
      showRevert: true,
      isFinal: true
    });
  });

  it("hides all actions for confirmed attendance", () => {
    const state = getInvitationDecisionVisibility("confirmed_attendance");
    expect(state).toEqual({
      showAccept: false,
      showDecline: false,
      showConfirm: false,
      showRevert: true,
      isFinal: true
    });
  });

  it("hides all actions for cancelled", () => {
    const state = getInvitationDecisionVisibility("cancelled");
    expect(state).toEqual({
      showAccept: false,
      showDecline: false,
      showConfirm: false,
      showRevert: false,
      isFinal: true
    });
  });
});
