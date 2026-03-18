import { describe, expect, it } from "vitest";
import { filterEssentialNotifications, getNotificationMeta } from "./notifications";

describe("notifications helpers", () => {
  it("keeps only essential non-audit notifications", () => {
    const visible = filterEssentialNotifications([
      {
        id: "1",
        title: "Request approved",
        message: "Request REQ-1 was approved.",
        created_at: "2026-03-17T08:00:00Z",
        href: "/requests/1",
        kind: "event",
        is_read: false,
      },
      {
        id: "2",
        title: "Admin created request",
        message: "Audit entry",
        created_at: "2026-03-17T08:05:00Z",
        href: "/activity",
        kind: "audit",
        is_read: false,
      },
      {
        id: "3",
        title: "Low level system ping",
        message: "Noise",
        created_at: "2026-03-17T08:10:00Z",
        href: null,
        kind: "system",
        is_read: true,
      },
    ]);

    expect(visible).toHaveLength(1);
    expect(visible[0]?.title).toBe("Request approved");
  });

  it("returns metadata for actionable titles", () => {
    const meta = getNotificationMeta({
      id: "1",
      title: "Payment recorded",
      message: "Payment recorded for REQ-5",
      created_at: "2026-03-17T08:00:00Z",
      href: "/payments",
      kind: "event",
      is_read: false,
    });

    expect(meta.fallbackTitle).toBe("Payment recorded");
    expect(meta.accent).toContain("text-cyan");
  });
});
