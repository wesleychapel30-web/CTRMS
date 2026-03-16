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
    <div className="grid min-h-screen place-items-center bg-slate-100 px-5 dark:bg-slate-950">
      <div className="grid w-full max-w-4xl gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col items-center gap-3 text-center">
            {branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt={branding.organization_name}
                className="h-20 w-20 rounded-xl border border-slate-200 bg-white object-contain p-1.5 dark:border-slate-700 dark:bg-slate-900"
              />
            ) : null}
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{branding?.site_name ?? "CTRMS"}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{branding?.organization_name ?? "Institution"}</p>
            </div>
          </div>
          <h1 className="mt-8 text-3xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">{children}</div>
      </div>
    </div>
  );
}
