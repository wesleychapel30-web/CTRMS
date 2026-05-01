import { useEffect, useState, type ReactNode } from "react";
import { resolveAssetUrl } from "../lib/api";
import type { BrandingSettings } from "../types";

type AuthLayoutProps = {
  branding: BrandingSettings | null;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

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
      <div className="auth-split-brand relative hidden flex-col overflow-hidden p-10 lg:flex lg:w-[50%] xl:w-[55%] xl:p-14">

        {/* Decorative background layers */}
        <div className="auth-split-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="auth-split-glow pointer-events-none absolute" aria-hidden="true" />
        <div className="auth-split-ring-a pointer-events-none absolute" aria-hidden="true" />
        <div className="auth-split-ring-b pointer-events-none absolute" aria-hidden="true" />

        {/* Logo lockup — top */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
            {logoUrl && !logoFailed ? (
              <img
                src={logoUrl}
                alt={orgName}
                onError={() => setLogoFailed(true)}
                className="max-h-8 w-auto object-contain"
              />
            ) : (
              <span className="text-base font-bold text-white">C</span>
            )}
          </div>
          <div>
            <p className="headline-font text-base font-bold tracking-[-0.03em] text-white">{siteName}</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/58">{orgName}</p>
          </div>
        </div>

        {/* Hero copy — vertically centred */}
        <div className="relative z-10 flex flex-1 items-center">
          <div>
            <h2 className="headline-font text-[2.1rem] font-extrabold leading-[1.1] tracking-[-0.05em] text-white xl:text-[2.5rem]">
              Enterprise request management.
            </h2>
          </div>
        </div>
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
      </div>
    </div>
  );
}
