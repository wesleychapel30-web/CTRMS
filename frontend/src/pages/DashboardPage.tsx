import { useEffect, useMemo, useState } from "react";
import { BarChart, DonutChart, LineChart, Timeline } from "../components/Charts";
import { StatePanel } from "../components/FeedbackStates";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { fetchEnterpriseOverview, fetchPublicBranding } from "../lib/api";
import { formatCurrency } from "../lib/format";
import type { BrandingSettings, ChartDatum, EnterpriseOverview, Stat } from "../types";

const chartColors = [
  "var(--accent)",
  "var(--accent-dim)",
  "var(--surface-highest)",
  "var(--surface-high)",
];

export function DashboardPage() {
  const [overview, setOverview] = useState<EnterpriseOverview | null>(null);
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchEnterpriseOverview(), fetchPublicBranding()])
      .then(([enterprisePayload, brandingPayload]) => {
        setOverview(enterprisePayload);
        setBranding(brandingPayload.branding);
        setError(null);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load the dashboard"))
      .finally(() => setIsLoading(false));
  }, []);

  const currencyCode = overview?.organization?.currency_code ?? "TZS";
  const moduleMixData = useMemo(() => {
    const items = overview?.charts.module_mix ?? [];
    const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
    return items.map((item, index) => ({
      ...item,
      value: Math.round((item.value / total) * 100),
      color: chartColors[index % chartColors.length]
    }));
  }, [overview]);

  if (error) {
    return <StatePanel variant="error" title="Dashboard unavailable" message={error} />;
  }

  if (isLoading || !overview) {
    return <StatePanel variant="loading" title="Loading dashboard" message="Loading summary data." />;
  }

  const stats: Stat[] = [
    {
      label: "Open Requests",
      value: String(overview.summary.open_purchase_requests),
      change: `${overview.summary.active_workflows} active workflow templates`,
      tone: "accent"
    },
    {
      label: "Orders In Flight",
      value: String(overview.summary.issued_purchase_orders),
      change: `${overview.summary.pending_payments} payment queue items`,
      tone: "warning"
    },
    {
      label: "Committed Budget",
      value: formatCurrency(overview.summary.committed_budget, currencyCode),
      change: `${overview.summary.departments} shared departments`,
      tone: "success"
    },
    {
      label: "Spent Budget",
      value: formatCurrency(overview.summary.spent_budget, currencyCode),
      change: `${Math.round(overview.summary.inventory_units)} inventory units on hand`,
      tone: "danger"
    }
  ];

  const spendTrend: ChartDatum[] = overview.charts.spend_trend.map((item) => ({ ...item, value: Number(item.value) }));
  const procurementPipeline: ChartDatum[] = overview.charts.procurement_pipeline.map((item) => ({ ...item, value: Number(item.value) }));

  return (
    <div className="space-y-4">
      <section className="slate-rail overflow-hidden rounded-xl p-4 text-white shadow-[var(--shadow-ambient)]">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(34rem,1.6fr)] xl:items-center">
          <div className="min-w-0">
            <h2 className="headline-font truncate text-xl font-extrabold tracking-[-0.06em] sm:text-2xl">
              {overview.organization?.name || branding?.organization_name || "Dashboard"}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75">
              <span className="rounded-full bg-white/10 px-2.5 py-1">{overview.organization?.currency_code || "TZS"} currency</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">{overview.organization?.timezone || "Africa/Nairobi"} timezone</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">{overview.summary.organizations} organization(s)</span>
            </div>
          </div>

          <div className="rounded-lg bg-white/10 px-3 py-2.5 backdrop-blur">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="border-white/10 sm:border-r sm:pr-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">Payments</p>
                <p className="headline-font mt-0.5 text-xl font-extrabold tracking-[-0.05em]">{overview.summary.pending_payments}</p>
                <p className="text-[9px] font-medium text-white/45">Awaiting settlement</p>
              </div>
              <div className="border-white/10 sm:border-r sm:pr-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">Invoices</p>
                <p className="headline-font mt-0.5 text-xl font-extrabold tracking-[-0.05em]">{overview.summary.draft_invoices}</p>
                <p className="text-[9px] font-medium text-white/45">In review</p>
              </div>
              <div className="border-white/10 sm:border-r sm:pr-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">Attention</p>
                <p className="headline-font mt-0.5 text-xl font-extrabold tracking-[-0.05em]">{overview.alerts.length}</p>
                <p className="text-[9px] font-medium text-white/45">Items flagged</p>
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">Approvals</p>
                <p className="headline-font mt-0.5 text-xl font-extrabold tracking-[-0.05em]">{overview.summary.my_pending_approvals}</p>
                <p className="text-[9px] font-medium text-white/45">My queue</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <div key={stat.label} className={`item-enter item-enter-${index + 1}`}>
            <StatCard {...stat} />
          </div>
        ))}
      </div>

      {overview.alerts.length ? (
        <SectionCard title="Alerts">
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {overview.alerts.map((alert) => (
              <article key={alert.title} className="rounded-lg border border-[var(--surface-container)] bg-[var(--surface-low)] px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--danger)]">{alert.title}</p>
                <p className="mt-1.5 text-xs font-medium text-[var(--ink)]">{alert.message}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-7">
          <SectionCard title="Spend Trend" subtitle="Invoice totals over time.">
            <LineChart data={spendTrend} />
          </SectionCard>
        </div>

        <div className="col-span-12 xl:col-span-5">
          <SectionCard title="Module Mix" subtitle="Activity by module.">
            <DonutChart data={moduleMixData} centerLabel="Modules" />
          </SectionCard>
        </div>

        <div className="col-span-12 xl:col-span-6">
          <SectionCard title="Procurement Pipeline" subtitle="Request stages.">
            <BarChart data={procurementPipeline} valueSuffix="" />
          </SectionCard>
        </div>

        <div className="col-span-12 xl:col-span-6">
          <SectionCard title="Recent Activity">
            <Timeline items={overview.timeline} compact />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
