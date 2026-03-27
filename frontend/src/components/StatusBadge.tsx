type StatusBadgeProps = {
  status: string;
};

const statusMap: Record<string, string> = {
  draft: "bg-[var(--surface-high)] text-[var(--muted)]",
  pending: "bg-[#d5e3fc] text-[#455367]",
  under_review: "bg-[#e3dbfd] text-[#514d68]",
  approved: "bg-[#fde5e3] text-[#7b302d]",
  rejected: "bg-[#fe8983]/20 text-[#752121]",
  partially_paid: "bg-[var(--accent-soft)] text-[var(--accent-dim)]",
  paid: "bg-[#d7f3e4] text-[#1b6c4f]",
  cancelled: "bg-[var(--surface-high)] text-[var(--muted)]",
  archived: "bg-[var(--surface-high)] text-[var(--muted)]",
  pending_review: "bg-[#d5e3fc] text-[#455367]",
  accepted: "bg-[var(--accent-soft)] text-[var(--accent-dim)]",
  declined: "bg-[#fe8983]/20 text-[#752121]",
  confirmed_attendance: "bg-[#d7f3e4] text-[#1b6c4f]",
  completed: "bg-[var(--surface-high)] text-[var(--muted)]"
};

function normalizeStatus(status: string) {
  return status.toLowerCase().replace(/\s+\/\s+/g, "_").replace(/\s+/g, "_");
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = normalizeStatus(status);
  return (
    <span
      className={`inline-flex rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
        statusMap[normalized] ?? "bg-[var(--surface-high)] text-[var(--muted)]"
      }`}
    >
      {status}
    </span>
  );
}
