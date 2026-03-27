import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [holdRedirect, setHoldRedirect] = useState(false);
  const [authPhase, setAuthPhase] = useState<"idle" | "submitting" | "success">("idle");
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const redirectTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  if (user && !holdRedirect) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHoldRedirect(true);
    setAuthPhase("submitting");
    setIsSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      setAuthPhase("success");
      redirectTimerRef.current = window.setTimeout(() => {
        navigate("/", { replace: true });
      }, 780);
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
      setAuthPhase("idle");
      setHoldRedirect(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      branding={branding}
      title="Sign In"
      subtitle="Use your account credentials to continue."
    >
      <div className="auth-form-shell relative">
        <form onSubmit={handleSubmit} className={`space-y-5 ${authPhase === "success" ? "auth-form-shell-success" : ""}`}>
          <label className="grid gap-2">
            <span className="section-kicker">Email or terminal ID</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={authPhase === "success"}
              className="institutional-input w-full rounded-md px-4 py-3.5 text-[var(--ink)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
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
              disabled={authPhase === "success"}
              className="institutional-input w-full rounded-md px-4 py-3.5 text-[var(--ink)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="Enter your password"
              type="password"
            />
          </label>

          <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <input type="checkbox" disabled={authPhase === "success"} className="rounded border-[var(--line)]" />
            <span>Remember this device for 24 hours</span>
          </label>

          {error ? <InlineBanner variant="error" title="Sign-in failed" message={error} /> : null}

          <button
            disabled={isSubmitting || authPhase === "success"}
            className="primary-button inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3.5 text-sm font-semibold shadow-sm disabled:opacity-60"
          >
            {authPhase === "success" ? <ShieldCheck className="h-4 w-4" /> : null}
            {authPhase === "submitting" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {authPhase === "success" ? "Access Granted" : authPhase === "submitting" ? "Authorizing..." : "Authorize Access"}
          </button>
        </form>

        {authPhase === "success" ? (
          <div className="auth-success-overlay">
            <div className="auth-success-card">
              <div className="auth-success-orb auth-success-orb-a" />
              <div className="auth-success-orb auth-success-orb-b" />
              <div className="auth-success-icon">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="headline-font text-2xl font-extrabold tracking-[-0.05em] text-[var(--ink)]">Access granted</p>
              <p className="mt-2 text-sm text-[var(--muted)]">Preparing your workspace and loading permissions.</p>
            </div>
          </div>
        ) : null}
      </div>
    </AuthLayout>
  );
}
