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
    >
      <div className="auth-form-shell relative">
        <form onSubmit={handleSubmit} className={`space-y-2.5 ${authPhase === "success" ? "auth-form-shell-success" : ""}`}>
          <label className="grid gap-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/70">Username or email</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={authPhase === "success"}
              className="auth-input w-full rounded-md px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="Username or email"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/70">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={authPhase === "success"}
              className="auth-input w-full rounded-md px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="Enter your password"
              type="password"
            />
          </label>

          <label className="flex items-center gap-2 text-[11px] font-medium text-white/78">
            <input type="checkbox" disabled={authPhase === "success"} className="h-3 w-3 rounded border-white/45 bg-white/12 accent-white" />
            <span>Remember for 24 hours</span>
          </label>

          {error ? <InlineBanner variant="error" title="Sign-in failed" message={error} /> : null}

          <button
            disabled={isSubmitting || authPhase === "success"}
            className="auth-submit-button inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold shadow-sm disabled:opacity-60"
          >
            {authPhase === "success" ? <ShieldCheck className="h-4 w-4" /> : null}
            {authPhase === "submitting" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {authPhase === "success" ? "Signed In" : authPhase === "submitting" ? "Signing in..." : "Sign In"}
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
              <p className="headline-font text-2xl font-extrabold tracking-[-0.05em] text-[var(--ink)]">Signed in</p>
              <p className="mt-2 text-sm text-[var(--muted)]">Loading your dashboard.</p>
            </div>
          </div>
        ) : null}
      </div>
    </AuthLayout>
  );
}
