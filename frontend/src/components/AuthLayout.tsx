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

  return (
    <div className="auth-blue-shell relative min-h-screen overflow-hidden px-5 py-8 text-white">
      <div className="auth-blue-bg pointer-events-none absolute inset-0 overflow-hidden">
        <div className="auth-blue-orb auth-blue-orb-a" />
        <div className="auth-blue-orb auth-blue-orb-b" />
        <div className="auth-blue-orb auth-blue-orb-c" />
        <div className="auth-blue-loop auth-blue-loop-a" />
        <div className="auth-blue-loop auth-blue-loop-b" />
        <div className="auth-blue-ribbon auth-blue-ribbon-a" />
        <div className="auth-blue-ribbon auth-blue-ribbon-b" />
        <div className="auth-blue-ribbon auth-blue-ribbon-c" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl place-items-center">
        <div className="auth-blue-stage relative grid min-h-[34rem] w-full place-items-center overflow-hidden rounded-3xl px-5 py-10 shadow-[0_28px_80px_rgba(12,36,72,0.34)] sm:px-8">
          <div className="auth-stage-mark auth-stage-mark-a" />
          <div className="auth-stage-mark auth-stage-mark-b" />
          <div className="auth-stage-mark auth-stage-mark-c" />
          <div className="auth-stage-mark auth-stage-mark-d" />
          <div className="auth-stage-dots" />

          <div className="auth-brand-lockup absolute left-6 top-6 z-[2] flex items-center gap-3 sm:left-10 sm:top-9">
            {logoUrl && !logoFailed ? (
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-white p-2 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
                <img
                  src={logoUrl}
                  alt={branding?.organization_name || "CTRMS"}
                  onError={() => setLogoFailed(true)}
                  className="max-h-10 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-white/12 text-xl font-bold">C</div>
            )}
            <div>
              <p className="headline-font text-xl font-bold tracking-[-0.04em]">{branding?.site_name || "CTRMS"}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">Request Management</p>
            </div>
          </div>

          <section className="auth-glass-card relative z-[2] w-full max-w-[21rem] rounded-3xl px-5 py-5 text-white shadow-[0_22px_70px_rgba(8,27,55,0.28)] sm:px-6">
            <h1 className="headline-font text-center text-3xl font-extrabold tracking-[-0.06em]">{title}</h1>
            <div className="mt-3">{children}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
