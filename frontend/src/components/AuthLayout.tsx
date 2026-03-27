import type { ReactNode } from "react";
import type { BrandingSettings } from "../types";

type AuthLayoutProps = {
  branding: BrandingSettings | null;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthLayout({ branding, title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="soft-grid relative min-h-screen overflow-hidden bg-[var(--surface)] px-5 py-8 text-[var(--ink)]">
      <div className="absolute left-[3vw] top-[4vh] text-[clamp(6rem,18vw,11rem)] font-extrabold tracking-[-0.08em] text-slate-200/55 dark:text-slate-800/35">
        CTRMS
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl place-items-center">
        <div className="grid w-full overflow-hidden rounded-2xl bg-[var(--surface-card)] shadow-[0_18px_70px_rgba(15,23,42,0.12)] lg:grid-cols-[0.95fr_1.05fr]">
          <section className="dark-hero-card flex flex-col justify-between p-8 text-white sm:p-10">
            <div>
              <div className="flex items-center gap-3">
                {branding?.logo_url ? (
                  <div className="grid h-16 w-16 place-items-center rounded-xl bg-white/8 p-2">
                    <img
                      src={branding.logo_url}
                      alt={branding.organization_name || "CTRMS"}
                      className="max-h-12 w-auto object-contain"
                    />
                  </div>
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-xl bg-white/8 text-xl font-bold">C</div>
                )}
                <div>
                  <p className="headline-font text-xl font-bold tracking-[-0.04em]">{branding?.site_name || "CTRMS"}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
                    Institutional Architect
                  </p>
                </div>
              </div>

              <div className="mt-16 max-w-md">
                <p className="headline-font text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.06em]">
                  Institutional precision for requests, approvals, and official invitations.
                </p>
                <p className="mt-5 max-w-sm text-sm leading-7 text-white/68">
                  A secure internal workspace for structured decision-making, document review, financial oversight, and executive coordination.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-white/5 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">System Status</p>
              <div className="mt-4 flex items-center gap-3 text-sm text-white/80">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span>Platform services operational.</span>
              </div>
              <p className="mt-5 text-[11px] text-white/35">
                {(branding?.organization_name || "CTRMS").trim()} secure access environment.
              </p>
            </div>
          </section>

          <section className="relative bg-[var(--surface-card)] px-6 py-10 sm:px-10 lg:px-12">
            <div className="absolute inset-y-0 left-0 hidden w-px bg-[var(--line)] lg:block" />
            <div className="mx-auto flex h-full max-w-xl flex-col justify-center">
              <div>
                <h1 className="headline-font text-3xl font-extrabold tracking-[-0.05em] text-[var(--ink)]">{title}</h1>
                <p className="mt-3 max-w-md text-sm leading-7 text-[var(--muted)]">{subtitle}</p>
              </div>
              <div className="mt-8">{children}</div>
              <p className="mt-8 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                Protected by authenticated institutional access and recorded session controls.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
