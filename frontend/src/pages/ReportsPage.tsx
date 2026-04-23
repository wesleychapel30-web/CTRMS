import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BarChart, LineChart } from "../components/Charts";
import { InlineBanner, StatePanel } from "../components/FeedbackStates";
import { FilterBar } from "../components/FilterBar";
import { SectionCard } from "../components/SectionCard";
import { useSession } from "../context/SessionContext";
import { downloadApiFile, fetchRequestReport } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { formatCurrency } from "../lib/format";
import type { ChartDatum, RequestReportSummary } from "../types";

export function ReportsPage() {
  const { hasPermission } = useSession();
  const toast = useToast();
  const [report, setReport] = useState<RequestReportSummary | null>(null);
  const [trendData, setTrendData] = useState<ChartDatum[]>([]);
  const [approvalRate, setApprovalRate] = useState<ChartDatum[]>([]);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exportingType, setExportingType] = useState<"excel" | "pdf" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) {
      params.set("status", status);
    }
    if (category) {
      params.set("category", category);
    }
    if (fromDate) {
      params.set("created_at__gte", new Date(`${fromDate}T00:00:00`).toISOString());
    }
    if (toDate) {
      params.set("created_at__lte", new Date(`${toDate}T23:59:59.999`).toISOString());
    }

    setIsLoading(true);
    setError(null);
    fetchRequestReport(params)
      .then((reportData) => {
        setReport(reportData);
        setTrendData(reportData.charts?.monthly_trend ?? []);
        setApprovalRate(reportData.charts?.approval_rate ?? []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load reports"))
      .finally(() => setIsLoading(false));
  }, [status, category, fromDate, toDate]);

  const categorySummary = useMemo(() => (report ? Object.entries(report.category_stats) : []), [report]);

  const exportParams = new URLSearchParams();
  if (status) exportParams.set("status", status);
  if (category) exportParams.set("category", category);
  if (fromDate) exportParams.set("created_at__gte", new Date(`${fromDate}T00:00:00`).toISOString());
  if (toDate) exportParams.set("created_at__lte", new Date(`${toDate}T23:59:59.999`).toISOString());
  const exportSuffix = exportParams.toString() ? `?${exportParams.toString()}` : "";
  const canExport = hasPermission("report:export");

  const handleExport = async (type: "excel" | "pdf") => {
    setExportingType(type);
    try {
      const filename = await downloadApiFile(
        `/export/requests-${type}/${exportSuffix}`,
        `request-report.${type === "excel" ? "xlsx" : "pdf"}`
      );
      toast.success(`${filename} downloaded.`, "Export complete");
    } catch (reason: unknown) {
      toast.error(reason instanceof Error ? reason.message : "Export failed");
    } finally {
      setExportingType(null);
    }
  };

  if (error && !report) {
    return <StatePanel variant="error" title="Reports unavailable" message={error} />;
  }

  if (isLoading && !report) {
    return <StatePanel variant="loading" title="Loading reports" message="Loading report data." />;
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Reports"
        action={
          canExport ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleExport("excel")}
                disabled={exportingType !== null}
                className="inline-flex items-center gap-2 rounded-sm bg-[var(--surface-low)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" />
                {exportingType === "excel" ? "Exporting..." : "Export Excel"}
              </button>
              <button
                type="button"
                onClick={() => void handleExport("pdf")}
                disabled={exportingType !== null}
                className="primary-button inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" />
                {exportingType === "pdf" ? "Exporting..." : "Export PDF"}
              </button>
            </div>
          ) : null
        }
      >
        {error ? <InlineBanner variant="warning" title="Report refresh issue" message={error} className="mb-3" /> : null}
        <FilterBar className="mb-3 rounded-lg bg-[var(--surface-low)] p-3">
          <label className="grid gap-2 text-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">From</span>
            <input value={fromDate} onChange={(event) => setFromDate(event.target.value)} type="date" className="institutional-input rounded-sm px-3 py-2.5 outline-none" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">To</span>
            <input value={toDate} onChange={(event) => setToDate(event.target.value)} type="date" className="institutional-input rounded-sm px-3 py-2.5 outline-none" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="institutional-input rounded-sm px-3 py-2.5 outline-none">
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid / Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="institutional-input rounded-sm px-3 py-2.5 outline-none">
              <option value="">All categories</option>
              <option value="tuition">Tuition</option>
              <option value="medical">Medical Support</option>
              <option value="construction">Construction Aid</option>
              <option value="event_sponsorship">Event Sponsorship</option>
              <option value="other">Other</option>
            </select>
          </label>
        </FilterBar>

        {report ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-[var(--surface-low)] px-4 py-3 text-sm">
              Total requests: <strong>{report.total_requests}</strong>
            </div>
            <div className="rounded-lg bg-[var(--surface-low)] px-4 py-3 text-sm">
              Approved: <strong>{report.approved_requests}</strong>
            </div>
            <div className="rounded-lg bg-[var(--surface-low)] px-4 py-3 text-sm">
              Disbursed: <strong>{formatCurrency(report.total_disbursed)}</strong>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Request Trend">
          <LineChart data={trendData.length ? trendData : [{ label: "N/A", value: 0 }]} />
        </SectionCard>
        <SectionCard title="Approval vs Rejection">
          <BarChart data={approvalRate.length ? approvalRate : [{ label: "N/A", value: 0 }]} />
        </SectionCard>
      </div>

      <SectionCard title="Category Summary">
        <div className="grid gap-3 md:grid-cols-2">
          {categorySummary.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-[var(--surface-low)] px-3 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
              <p className="headline-font mt-1.5 text-sm font-bold text-[var(--ink)]">{value.count} requests</p>
              <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">{formatCurrency(value.total_amount)}</p>
            </div>
          ))}
          {!categorySummary.length ? <p className="text-sm text-[var(--muted)]">No category data available for the selected filters.</p> : null}
        </div>
      </SectionCard>
    </div>
  );
}
