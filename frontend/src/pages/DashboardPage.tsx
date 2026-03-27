import { useEffect, useState } from "react";
import { BarChart, DonutChart, LineChart, Timeline } from "../components/Charts";
import { StatePanel } from "../components/FeedbackStates";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { fetchDashboardOverview, fetchPublicBranding } from "../lib/api";
import { formatCurrency } from "../lib/format";
import type { BrandingSettings, ChartDatum, DashboardOverview, Stat } from "../types";

const categoryColors = ["#545f73", "#6f7e95", "#8fa1bd", "#b4c3db", "#605c78"];

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchDashboardOverview(), fetchPublicBranding()])
      .then(([data, brandingPayload]) => {
        const categoryBreakdown = data.charts.category_breakdown.map((item, index) => ({
          ...item,
          color: categoryColors[index % categoryColors.length]
        }));
        setOverview({ ...data, charts: { ...data.charts, category_breakdown: categoryBreakdown } });
        setBranding(brandingPayload.branding);
        setError(null);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load dashboard"))
      .finally(() => setIsLoading(false));
  }, []);

  if (error) {
    return <StatePanel variant="error" title="Dashboard unavailable" message={error} />;
  }

  if (isLoading || !overview) {
    return <StatePanel variant="loading" title="Loading dashboard" message="Preparing request, approval, and finance summaries." />;
  }

  const stats: Stat[] = [
    { label: "Total Requests", value: String(overview.stats.total_requests), change: `${overview.stats.approval_rate}% approval rate`, tone: "accent" },
    { label: "Pending Requests", value: String(overview.stats.pending_requests), change: `${overview.stats.under_review} under review`, tone: "warning" },
    { label: "Approved Requests", value: String(overview.stats.approved_requests), change: `${overview.stats.paid_requests} paid / completed`, tone: "success" },
    { label: "Rejected Requests", value: String(overview.stats.rejected_requests), change: "Closed decisions", tone: "danger" }
  ];

  const approvalRateData: ChartDatum[] = overview.charts.approval_rate.map((item) => ({ ...item, value: Number(item.value) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 surface-panel overflow-hidden rounded-xl">
          <div className="flex items-center justify-between bg-[var(--surface-card)] px-6 py-5">
            <div>
              <h3 className="headline-font text-lg font-bold tracking-[-0.03em] text-[var(--ink)]">Financial Summary</h3>
              <p className="mt-1 text-sm font-medium text-[var(--muted)]">Current funding, approvals, and disbursement position.</p>
            </div>
            <span className="rounded-sm bg-[var(--surface-low)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
              Institution
            </span>
          </div>
          <div className="grid gap-px bg-[var(--surface-container)] md:grid-cols-3">
            <div className="bg-[var(--surface-card)] px-8 py-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Amount Requested</p>
              <p className="headline-font mt-4 text-4xl font-extrabold tracking-[-0.05em] text-[var(--ink)]">
                {formatCurrency(overview.stats.total_requested)}
              </p>
              <p className="mt-2 text-xs font-semibold text-[var(--muted)]">All recorded request submissions</p>
            </div>
            <div className="bg-[var(--surface-card)] px-8 py-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Amount Approved</p>
              <p className="headline-font mt-4 text-4xl font-extrabold tracking-[-0.05em] text-[var(--ink)]">
                {formatCurrency(overview.stats.total_approved)}
              </p>
              <p className="mt-2 text-xs font-semibold text-[var(--success)]">Approved for release</p>
            </div>
            <div className="bg-[var(--surface-card)] px-8 py-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Amount Disbursed</p>
              <p className="headline-font mt-4 text-4xl font-extrabold tracking-[-0.05em] text-[var(--ink)]">
                {formatCurrency(overview.stats.total_disbursed)}
              </p>
              <p className="mt-2 text-xs font-semibold text-[var(--accent)]">Processed payments</p>
            </div>
          </div>
        </div>

        <div className="col-span-12 grid gap-6 lg:col-span-4">
          <div className="rounded-xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-dim)_100%)] p-6 text-white shadow-[var(--shadow-ambient)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">Total Requests</p>
            <div className="mt-6 flex items-end justify-between gap-4">
              <span className="headline-font text-5xl font-extrabold tracking-[-0.06em]">{overview.stats.total_requests}</span>
              <span className="rounded-sm bg-white/14 px-2.5 py-1 text-xs font-bold">
                {overview.stats.pending_requests} pending
              </span>
            </div>
          </div>
          <div className="surface-panel rounded-xl p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Pending Approvals</p>
            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <p className="headline-font text-4xl font-extrabold tracking-[-0.05em] text-[var(--ink)]">{overview.stats.under_review}</p>
                <p className="mt-2 text-sm font-medium text-[var(--muted)]">Requests currently awaiting director action.</p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-full bg-[#fe8983]/20 text-[var(--danger)]">!</div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-9">
          <SectionCard title="Request Trends" subtitle="Activity volume over the recent reporting window.">
            <LineChart data={overview.charts.monthly_trend} />
          </SectionCard>
        </div>

        <div className="col-span-12 lg:col-span-3">
          <SectionCard title="Recent Activity" subtitle="Upcoming events and request milestones.">
            <Timeline items={overview.timeline} />
          </SectionCard>
        </div>

        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <SectionCard title="Requests by Category">
            <DonutChart data={overview.charts.category_breakdown} />
          </SectionCard>
        </div>

        <div className="col-span-12 md:col-span-6 xl:col-span-5">
          <SectionCard title="Approval Rate">
            <BarChart data={approvalRateData} />
          </SectionCard>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
            {branding ? (
              <article className="surface-panel rounded-xl p-5 md:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Institution</p>
                <div className="mt-4 flex items-center gap-4">
                  {branding.logo_url ? (
                    <img src={branding.logo_url} alt={branding.organization_name} className="h-16 w-16 rounded-sm bg-[var(--surface-low)] object-contain p-2" />
                  ) : null}
                  <div>
                    <p className="headline-font text-lg font-bold tracking-[-0.03em] text-[var(--ink)]">
                      {branding.organization_name || "Institution"}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--muted)]">{branding.site_name || "CTRMS"}</p>
                    <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                      {overview.stats.upcoming_invitations} upcoming invitations · {overview.stats.events_next_week} events in 7 days
                    </p>
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
