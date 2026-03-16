import { useEffect, useState } from "react";
import { BarChart, DonutChart, LineChart, Timeline } from "../components/Charts";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { fetchDashboardOverview, fetchPublicBranding } from "../lib/api";
import { formatCurrency } from "../lib/format";
import type { BrandingSettings, ChartDatum, DashboardOverview, Stat } from "../types";

const categoryColors = ["#2563eb", "#0891b2", "#f59e0b", "#7c3aed"];

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchDashboardOverview(), fetchPublicBranding()])
      .then(([data, brandingPayload]) => {
        const categoryBreakdown = data.charts.category_breakdown.map((item, index) => ({
          ...item,
          color: categoryColors[index % categoryColors.length]
        }));
        setOverview({ ...data, charts: { ...data.charts, category_breakdown: categoryBreakdown } });
        setBranding(brandingPayload.branding);
      })
      .catch((reason) => setError(reason.message));
  }, []);

  if (error) {
    return <SectionCard title="Director Dashboard" subtitle="Unable to load dashboard">{error}</SectionCard>;
  }

  if (!overview) {
    return <SectionCard title="Director Dashboard" subtitle="Loading dashboard">Fetching records...</SectionCard>;
  }

  const stats: Stat[] = [
    { label: "Total Requests", value: String(overview.stats.total_requests), change: `${overview.stats.approval_rate}% approval`, tone: "accent" },
    { label: "Pending Requests", value: String(overview.stats.pending_requests), change: `${overview.stats.under_review} under review`, tone: "warning" },
    { label: "Approved Requests", value: String(overview.stats.approved_requests), change: `${overview.stats.paid_requests} paid`, tone: "success" },
    { label: "Rejected Requests", value: String(overview.stats.rejected_requests), change: "Rejected total", tone: "danger" },
    { label: "Upcoming Invitations", value: String(overview.stats.upcoming_invitations), change: `${overview.stats.events_next_week} next 7 days`, tone: "accent" },
    { label: "Events (7 Days)", value: String(overview.stats.events_next_week), change: "Scheduled events", tone: "warning" },
    { label: "Amount Requested", value: formatCurrency(overview.stats.total_requested), change: "Total requested", tone: "accent" },
    { label: "Amount Approved", value: formatCurrency(overview.stats.total_approved), change: "Total approved", tone: "success" },
    { label: "Amount Disbursed", value: formatCurrency(overview.stats.total_disbursed), change: "Total disbursed", tone: "success" }
  ];

  const approvalRateData: ChartDatum[] = overview.charts.approval_rate.map((item) => ({ ...item, value: Number(item.value) }));

  return (
    <div className="space-y-6">
      {branding ? (
        <SectionCard title="Institution">
          <div className="flex items-center gap-4">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.organization_name} className="h-20 w-20 rounded-2xl border border-slate-200/80 bg-white object-contain p-2 dark:border-white/10 dark:bg-white/90" />
            ) : null}
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{branding.organization_name || "Institution"}</p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Requests by Category">
          <DonutChart data={overview.charts.category_breakdown} />
        </SectionCard>
        <SectionCard title="Upcoming Events" subtitle="Next 7 days">
          <Timeline items={overview.timeline} />
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Request Trend">
          <LineChart data={overview.charts.monthly_trend} />
        </SectionCard>
        <SectionCard title="Approval Rate">
          <BarChart data={approvalRateData} />
        </SectionCard>
      </div>
    </div>
  );
}
