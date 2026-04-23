import { HistoryTimeline } from "./HistoryTimeline";
import { mapEnterpriseAuditTimeline } from "../lib/enterpriseWorkflow";
import type { EnterpriseAuditEntry } from "../types";

type EnterpriseTimelineProps = {
  entries: EnterpriseAuditEntry[];
  emptyMessage?: string;
};

export function EnterpriseTimeline({ entries, emptyMessage }: EnterpriseTimelineProps) {
  return <HistoryTimeline items={mapEnterpriseAuditTimeline(entries)} emptyMessage={emptyMessage} />;
}
