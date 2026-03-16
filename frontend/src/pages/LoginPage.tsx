import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { useSession } from "../context/SessionContext";
import { fetchPublicBranding } from "../lib/api";
import type { BrandingSettings } from "../types";

export function LoginPage() {
  const navigate = useNavigate();
  const { user, login } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branding, setBranding] = useState<BrandingSettings | null>(null);

  useEffect(() => {
    fetchPublicBranding()
      .then((payload) => {
        setBranding(payload.branding);
        if (payload.branding.favicon_url) {
          let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = payload.branding.favicon_url;
        }
      })
      .catch(() => null);
  }, []);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      navigate("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout branding={branding} title="Sign In" subtitle="Secure access to the request and invitation management system.">
      <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Account Access</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{branding?.organization_name ?? "Institution"} users only.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input value={username} onChange={(event) => setUsername(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" placeholder="Username" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" placeholder="Password" type="password" />
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button disabled={isSubmitting} className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-900">
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </AuthLayout>
  );
}
