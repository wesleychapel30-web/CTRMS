import { useEffect, useState, type ReactNode } from "react";
import { resolveAssetUrl } from "../lib/api";
import type { BrandingSettings } from "../types";

type AuthLayoutProps = {
  branding: BrandingSettings | null;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

const FEATURES = [
  "Multi-level approval workflows",
  "Real-time budget & inventory tracking",
  "Instant cross-team notifications",
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
      <polyline
        points="2,6 5,9 10,3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AuthLayout({ branding, title, children }: AuthLayoutProps) {
  const logoUrl = resolveAssetUrl(branding?.logo_url);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  const siteName = branding?.site_name || "CTRMS";
  const orgName = branding?.organization_name || "Institution";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">

      {/* ── Left branding panel (desktop only) ─────── */}
      <div className="auth-split-brand relative hidden flex-col justify-between overflow-hidden p-10 lg:flex lg:w-[50%] xl:w-[55%] xl:p-14">
        <div className="auth-split-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="auth-split-ring pointer-events-none absolute" aria-hidden="true" />

        {/* Logo lockup */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
            {logoUrl && !logoFailed ? (
              <img
                src={logoUrl}
                alt={orgName}
                onError={() => setLogoFailed(true)}
                className="max-h-9 w-auto object-contain"
              />
            ) : (
              <span className="text-lg font-bold text-white">C</span>
            )}
          </div>
          <div>
            <p className="headline-font text-base font-bold tracking-[-0.03em] text-white">{siteName}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/45">{orgName}</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 max-w-[28rem]">
          <h2 className="headline-font text-[2.4rem] font-extrabold leading-[1.1] tracking-[-0.04em] text-white xl:text-[2.8rem]">
            Enterprise request&nbsp;management,&nbsp;simplified.
          </h2>
          <p className="mt-5 text-[15px] leading-7 text-white/55">
            End-to-end procurement, approvals, payments, and reporting — unified for every team.
          </p>
          <ul className="mt-8 space-y-3.5">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm font-medium text-white/75">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/14 text-white">
                  <CheckIcon />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom tag */}
        <p className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
          Secure · Enterprise-ready
        </p>
      </div>

      {/* ── Right form panel ────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[var(--surface)] px-6 py-12 sm:px-10">

        {/* Mobile logo (hidden on desktop) */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-[var(--accent)] shadow-lg">
            {logoUrl && !logoFailed ? (
              <img
                src={logoUrl}
                alt={orgName}
                onError={() => setLogoFailed(true)}
                className="max-h-8 w-auto object-contain"
              />
            ) : (
              <span className="text-sm font-bold text-white">C</span>
            )}
          </div>
          <div>
            <p className="headline-font text-base font-bold tracking-[-0.03em] text-[var(--ink)]">{siteName}</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{orgName}</p>
          </div>
        </div>

        {/* Form card */}
        <div className="w-full max-w-[360px]">
          <h1 className="headline-font text-[1.65rem] font-extrabold tracking-[-0.04em] text-[var(--ink)]">
            {title}
          </h1>
          <div className="mt-6">{children}</div>
        </div>

        <p className="mt-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]/60">
          {orgName}
        </p>
      </div>
    </div>
  );
}
