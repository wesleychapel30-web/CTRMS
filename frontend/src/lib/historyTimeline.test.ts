import { describe, expect, it } from "vitest";
import { mapInvitationHistory, mapRequestHistory, mapTimelineEntries } from "./historyTimeline";

describe("history timeline mapping", () => {
  it("maps request history into timeline entries", () => {
    const entries = mapRequestHistory([
      {
        id: "r1",
        action: "approved",
        from_status: "under_review",
        to_status: "approved",
        comment: "Approved with revised amount.",
        performed_by: "user-1",
        performed_by_name: "Director One",
        created_at: "2026-03-17T08:00:00Z",
      },
    ]);

    expect(entries[0]).toMatchObject({
      label: "Request Status",
      title: "Request approved",
      actorName: "Director One",
      statusText: "Under Review -> Approved",
      body: "Approved with revised amount.",
      tone: "success",
    });
  });

  it("maps invitation history into timeline entries", () => {
    const entries = mapInvitationHistory([
      {
        id: "i1",
        action_type: "update",
        action_label: "Decision reverted",
        label: "Invitation Status",
        actor_name: "Director One",
        description: "Reverted invitation decision for Annual Forum.",
        comment: "Need another review.",
        from_status: "accepted",
        to_status: "pending_review",
        created_at: "2026-03-17T09:00:00Z",
      },
    ]);

    expect(entries[0]).toMatchObject({
      label: "Invitation Status",
      title: "Decision reverted",
      actorName: "Director One",
      statusText: "Accepted -> Pending Review",
      body: "Need another review.",
    });
  });

  it("maps generic chatter entries into timeline entries", () => {
    const entries = mapTimelineEntries([
      {
        id: "t1",
        entry_type: "internal_note",
        label: "Request Note",
        actor_name: "Administrator One",
        title: "Internal note logged",
        body: "Check supporting document before approval.",
        old_status: "",
        new_status: "",
        is_internal: true,
        created_at: "2026-03-17T09:30:00Z",
      },
    ]);

    expect(entries[0]).toMatchObject({
      label: "Request Note",
      title: "Internal note logged",
      actorName: "Administrator One",
      body: "Check supporting document before approval.",
      tone: "warning",
    });
  });
});
