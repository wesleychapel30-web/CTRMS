type StatusBadgeProps = {
  status: string;
  size?: "sm" | "md";
};

type StatusMeta = { bg: string; text: string };

const statusMap: Record<string, StatusMeta> = {
  draft:                { bg: "var(--status-neutral-bg)",  text: "var(--status-neutral-text)"  },
  pending:              { bg: "var(--status-info-bg)",     text: "var(--status-info-text)"     },
  submitted:            { bg: "var(--status-info-bg)",     text: "var(--status-info-text)"     },
  issued:               { bg: "var(--status-info-bg)",     text: "var(--status-info-text)"     },
  posted:               { bg: "var(--status-info-bg)",     text: "var(--status-info-text)"     },
  pending_review:       { bg: "var(--status-info-bg)",     text: "var(--status-info-text)"     },
  under_review:         { bg: "var(--status-purple-bg)",   text: "var(--status-purple-text)"   },
  approved:             { bg: "var(--status-success-bg)",  text: "var(--status-success-text)"  },
  paid:                 { bg: "var(--status-success-bg)",  text: "var(--status-success-text)"  },
  converted:            { bg: "var(--status-success-bg)",  text: "var(--status-success-text)"  },
  received:             { bg: "var(--status-success-bg)",  text: "var(--status-success-text)"  },
  active:               { bg: "var(--status-success-bg)",  text: "var(--status-success-text)"  },
  healthy:              { bg: "var(--status-success-bg)",  text: "var(--status-success-text)"  },
  confirmed_attendance: { bg: "var(--status-success-bg)",  text: "var(--status-success-text)"  },
  rejected:             { bg: "var(--status-danger-bg)",   text: "var(--status-danger-text)"   },
  on_hold:              { bg: "var(--status-danger-bg)",   text: "var(--status-danger-text)"   },
  under_reorder:        { bg: "var(--status-danger-bg)",   text: "var(--status-danger-text)"   },
  declined:             { bg: "var(--status-danger-bg)",   text: "var(--status-danger-text)"   },
  partially_paid:       { bg: "var(--status-accent-bg)",   text: "var(--status-accent-text)"   },
  accepted:             { bg: "var(--status-accent-bg)",   text: "var(--status-accent-text)"   },
  partially_received:   { bg: "var(--status-accent-bg)",   text: "var(--status-accent-text)"   },
  cancelled:            { bg: "var(--status-neutral-bg)",  text: "var(--status-neutral-text)"  },
  archived:             { bg: "var(--status-neutral-bg)",  text: "var(--status-neutral-text)"  },
  reconciled:           { bg: "var(--status-neutral-bg)",  text: "var(--status-neutral-text)"  },
  inactive:             { bg: "var(--status-neutral-bg)",  text: "var(--status-neutral-text)"  },
  completed:            { bg: "var(--status-neutral-bg)",  text: "var(--status-neutral-text)"  },
};

function normalizeStatus(status: string) {
  return status.toLowerCase().replace(/\s+\/\s+/g, "_").replace(/\s+/g, "_");
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const normalized = normalizeStatus(status);
  const meta = statusMap[normalized] ?? {
    bg: "var(--status-neutral-bg)",
    text: "var(--status-neutral-text)",
  };

  const sizeClass = size === "sm"
    ? "px-2 py-0.5 text-[9px]"
    : "px-2.5 py-1 text-[10px]";

  return (
    <span
      className={`inline-flex rounded-sm font-bold uppercase tracking-[0.12em] transition-colors ${sizeClass}`}
      style={{ background: meta.bg, color: meta.text }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
