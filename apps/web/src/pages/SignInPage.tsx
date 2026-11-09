import { Link, Navigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Github, GitPullRequest, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui";
import { API_URL } from "../lib/api";
import { useMe } from "../lib/query";

const HERO_IMAGE = "/brand/landing/hero-bg.png";

const OAUTH_ERRORS: Record<string, string> = {
  oauth_denied: "You cancelled the GitHub authorization. CommitScibble needs access to continue.",
  oauth_failed: "GitHub reported an error during authorization. Try again.",
  oauth_state_invalid: "The authorization request expired or could not be verified. Start again.",
  oauth_invalid_callback: "GitHub returned an incomplete callback. Start the sign-in flow again.",
  oauth_exchange_failed: "GitHub accepted the request but the token exchange failed. Try again shortly.",
};

export default function SignInPage() {
  const [params] = useSearchParams();
  const me = useMe();
  const errorCode = params.get("error");
  const errorMessage = errorCode ? OAUTH_ERRORS[errorCode] ?? "Sign-in failed. Try again." : null;

  if (me.data?.user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--background)]">
      <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="banner-wash absolute inset-0" />

      <div className="relative z-10 flex min-h-screen flex-col px-3 py-4 sm:px-6">
        <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between rounded-[14px] border border-white/25 bg-white/10 px-4 py-2.5 backdrop-blur-xl">
          <Link to="/" className="flex items-center gap-2.5" aria-label="CommitScibble home">
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[8px] bg-[#251f19]">
              <img src="/brand/logo.png" alt="" className="h-5 w-5 object-contain" />
            </span>
            <span className="font-display text-[15px] font-semibold tracking-tight text-white">
              CommitScibble
            </span>
          </Link>
          <Link
            to="/"
            className="hidden items-center gap-1 rounded-[9px] px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-white/15 sm:inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
        </header>

        <div className="mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-10 py-10 lg:grid-cols-2">
          <div className="content-swap text-white">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[12px] font-medium backdrop-blur-md">
              <span className="live-dot" /> Your repository workspace
            </div>
            <h1 className="font-display text-[40px] font-semibold leading-[1.03] tracking-[-0.035em] drop-shadow-[0_2px_16px_rgba(37,31,25,0.3)] sm:text-[56px]">
              Connect GitHub. Let your docs keep up.
            </h1>
            <p className="mt-5 max-w-[480px] text-[16px] leading-relaxed text-white/85">
              Analyse repositories, generate documentation from real source, and review focused
              proposals before anything reaches GitHub.
            </p>
            <ul className="mt-7 space-y-2.5 text-[13px] text-white/90">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#f48d16]" /> Tokens are encrypted at rest and
                never returned to the browser
              </li>
              <li className="flex items-center gap-2">
                <GitPullRequest className="h-4 w-4 text-[#f48d16]" /> Nothing is written without
                approval in review mode
              </li>
              <li className="flex items-center gap-2">
                <Github className="h-4 w-4 text-[#f48d16]" /> Access is limited to repositories you
                can already see on GitHub
              </li>
            </ul>
          </div>

          <div className="glass-panel-strong rounded-[24px] border p-6 shadow-[var(--shadow-float)] sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#251f19] text-[#f48d16]">
                <Github className="h-4 w-4" />
              </span>
              <div>
                <h2 className="dash-h3 text-[22px]">Sign in to CommitScibble</h2>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  Continue with GitHub to open your workspace.
                </p>
              </div>
            </div>

            {errorMessage ? (
              <div className="mb-4 flex items-start gap-2 rounded-[10px] border border-rose-500/30 bg-rose-500/5 p-3 text-[12px] text-rose-700 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            ) : null}

            <a href={`${API_URL}/auth/github`} className="block">
              <Button size="lg" className="w-full">
                <Github className="h-4 w-4" /> Continue with GitHub
              </Button>
            </a>

            <div className="mt-5 border-t border-[var(--border-soft)] pt-4 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              <p className="font-medium text-[var(--text-primary)]">Requested permission</p>
              <ul className="mt-1.5 space-y-1">
                <li>· Read your public profile and primary email</li>
                <li>· Read repository metadata, commits, and file contents</li>
                <li>· Write documentation commits to repositories you connect</li>
              </ul>
              <p className="mt-2">
                Access tokens are stored encrypted with AES-256-GCM and never returned to the
                browser. You can revoke the authorization at any time from settings.
              </p>
            </div>

            <ul className="mt-4 flex flex-wrap gap-2">
              {["AES-256-GCM", "HttpOnly sessions", "Revoke anytime"].map((fact) => (
                <li
                  key={fact}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f48d16]" aria-hidden />
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mx-auto w-full max-w-[1200px] text-center text-[11px] leading-relaxed text-white/70">
          By signing in you agree to let CommitScibble process repository content with the AI
          provider configured by this deployment. See{" "}
          <Link to="/docs" className="font-medium text-white underline underline-offset-2">
            the documentation
          </Link>{" "}
          for data handling details.
        </p>
      </div>
    </div>
  );
}
