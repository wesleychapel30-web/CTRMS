import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BarChart, LineChart } from "../components/Charts";
import { FilterBar } from "../components/FilterBar";
import { SectionCard } from "../components/SectionCard";
import { useSession } from "../context/SessionContext";
import { buildApiUrl, fetchRequestReport } from "../lib/api";
import { formatCurrency } from "../lib/format";
import type { ChartDatum, RequestReportSummary } from "../types";

export function ReportsPage() {
  const { hasPermission } = useSession();
  const [report, setReport] = useState<RequestReportSummary | null>(null);
  const [trendData, setTrendData] = useState<ChartDatum[]>([]);
  const [approvalRate, setApprovalRate] = useState<ChartDatum[]>([]);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState<string | null>(null);

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

    fetchRequestReport(params)
      .then((reportData) => {
        setReport(reportData);
        setTrendData(reportData.charts?.monthly_trend ?? []);
        setApprovalRate(reportData.charts?.approval_rate ?? []);
      })
      .catch((reason) => setError(reason.message));
  }, [status, category, fromDate, toDate]);

  const categorySummary = useMemo(() => (report ? Object.entries(report.category_stats) : []), [report]);

  const exportParams = new URLSearchParams();
  if (status) exportParams.set("status", status);
  if (category) exportParams.set("category", category);
  if (fromDate) exportParams.set("created_at__gte", new Date(`${fromDate}T00:00:00`).toISOString());
  if (toDate) exportParams.set("created_at__lte", new Date(`${toDate}T23:59:59.999`).toISOString());
  const exportSuffix = exportParams.toString() ? `?${exportParams.toString()}` : "";
  const excelExportUrl = buildApiUrl(`/export/requests-excel/${exportSuffix}`);
  const pdfExportUrl = buildApiUrl(`/export/requests-pdf/${exportSuffix}`);
  const canExport = hasPermission("report:export");

  return (
    <div className="space-y-6">
      <SectionCard
        title="Reports"
        subtitle="Operational and financial reporting."
        action={
          canExport ? (
            <div className="flex gap-2">
              <a href={excelExportUrl} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
                <Download className="h-4 w-4" />
                Export Excel
              </a>
              <a href={pdfExportUrl} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white dark:bg-blue-500">
                <Download className="h-4 w-4" />
                Export PDF
              </a>
            </div>
          ) : null
        }
      >
        <FilterBar className="mb-5">
          <label className="grid gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">From</span>
            <input value={fromDate} onChange={(event) => setFromDate(event.target.value)} type="date" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">To</span>
            <input value={toDate} onChange={(event) => setToDate(event.target.value)} type="date" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none dark:border-slate-700 dark:bg-slate-900">
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
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none dark:border-slate-700 dark:bg-slate-900">
              <option value="">All categories</option>
              <option value="tuition">Tuition</option>
              <option value="medical">Medical</option>
              <option value="construction">Construction</option>
              <option value="other">Other</option>
            </select>
          </label>
        </FilterBar>

        {report ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              Total requests: <strong>{report.total_requests}</strong>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              Approved: <strong>{report.approved_requests}</strong>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              Disbursed: <strong>{formatCurrency(report.total_disbursed)}</strong>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{error ?? "Loading reports..."}</p>
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
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
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{value.count} requests</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatCurrency(value.total_amount)}</p>
            </div>
          ))}
          {!categorySummary.length ? <p className="text-sm text-slate-500 dark:text-slate-400">No category data available for the selected filters.</p> : null}
        </div>
      </SectionCard>
    </div>
  );
}
