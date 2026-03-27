import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { InlineBanner } from "../components/FeedbackStates";
import { useSession } from "../context/SessionContext";
import { fetchPublicBranding } from "../lib/api";
import type { BrandingSettings } from "../types";

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Unable to sign in";
}

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
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      branding={branding}
      title="Secure Authentication"
      subtitle="Enter your institutional credentials to access the request and invitation management terminal."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="grid gap-2">
          <span className="section-kicker">Email or terminal ID</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="institutional-input w-full rounded-md px-4 py-3.5 text-[var(--ink)] outline-none"
            placeholder="name@organization.com"
          />
        </label>

        <label className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="section-kicker">Password</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Protected access</span>
          </div>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="institutional-input w-full rounded-md px-4 py-3.5 text-[var(--ink)] outline-none"
            placeholder="Enter your password"
            type="password"
          />
        </label>

        <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
          <input type="checkbox" className="rounded border-[var(--line)]" />
          <span>Remember this terminal for 24 hours</span>
        </label>

        {error ? <InlineBanner variant="error" title="Sign-in failed" message={error} /> : null}

        <button
          disabled={isSubmitting}
          className="primary-button inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3.5 text-sm font-semibold shadow-sm disabled:opacity-60"
        >
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? "Authorizing..." : "Authorize Access"}
        </button>
      </form>
    </AuthLayout>
  );
}
