export type InvitationDecisionVisibility = {
  showAccept: boolean;
  showDecline: boolean;
  showConfirm: boolean;
  showRevert: boolean;
  isFinal: boolean;
};

export function getInvitationDecisionVisibility(status: string): InvitationDecisionVisibility {
  const normalized = (status || "").toLowerCase();

  if (normalized === "pending_review") {
    return { showAccept: true, showDecline: true, showConfirm: false, showRevert: false, isFinal: false };
  }

  if (normalized === "accepted") {
    return { showAccept: false, showDecline: false, showConfirm: true, showRevert: true, isFinal: false };
  }

  if (
    normalized === "declined"
    || normalized === "confirmed_attendance"
  ) {
    return { showAccept: false, showDecline: false, showConfirm: false, showRevert: true, isFinal: true };
  }

  if (
    normalized === "completed"
    || normalized === "cancelled"
    || normalized === "archived"
  ) {
    return { showAccept: false, showDecline: false, showConfirm: false, showRevert: false, isFinal: true };
  }

  return { showAccept: false, showDecline: false, showConfirm: false, showRevert: false, isFinal: false };
}
