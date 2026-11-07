import { Link, Navigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Github, ShieldCheck } from "lucide-react";
import { Logo } from "../components/shell";
import { Button, Card, CardContent } from "../components/ui";
import { API_URL } from "../lib/api";
import { useMe } from "../lib/query";

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
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <header className="relative z-10 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-6 sm:px-8">
          <Logo />
          <Link
            to="/"
            className="rounded-full border border-border px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 ease-smooth hover:bg-muted hover:text-foreground"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-14">
        <div className="text-center">
          <p className="type-label text-brand-600 dark:text-brand-300">Account</p>
          <h1 className="type-title-lg mt-3">Sign in to CommitScibble</h1>
          <p className="mx-auto mt-3 max-w-sm text-[17px] leading-[1.7] text-muted-foreground">
            Continue with GitHub to connect repositories and review documentation proposals.
          </p>
        </div>

        {errorMessage ? (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <Card className="mt-7 shadow-card">
          <CardContent className="space-y-5 p-6 sm:p-7">
            <a href={`${API_URL}/auth/github`} className="block">
              <Button className="h-11 w-full" size="md">
                <Github className="h-4 w-4" /> Continue with GitHub
              </Button>
            </a>

            <div className="space-y-2 text-[15px] leading-[1.65] text-muted-foreground">
              <p className="font-medium text-foreground">Requested permission</p>
              <ul className="space-y-1">
                <li>· Read your public profile and primary email</li>
                <li>· Read repository metadata, commits, and file contents</li>
                <li>· Write documentation commits to repositories you connect</li>
              </ul>
              <p className="pt-1">
                Access is limited to repositories you can already see on GitHub. Private
                repositories are only available when your account has access to them.
              </p>
            </div>

            <div className="flex items-start gap-2 border-t border-border pt-4 text-[15px] leading-[1.65] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-300" />
              <p>
                Access tokens are stored encrypted with AES-256-GCM and never returned to the
                browser. You can revoke the authorization at any time from account settings.
              </p>
            </div>
          </CardContent>
        </Card>

        <ul className="mt-5 flex flex-wrap justify-center gap-2">
          {["AES-256-GCM", "HttpOnly sessions", "Revoke anytime"].map((fact) => (
            <li
              key={fact}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
              {fact}
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-[13px] leading-[1.6] text-muted-foreground">
          By signing in you agree to let CommitScibble process repository content with the AI
          provider configured by this deployment. See{" "}
          <Link
            to="/docs"
            className="font-medium text-brand-600 underline underline-offset-2 hover:opacity-80 dark:text-brand-300"
          >
            the documentation
          </Link>{" "}
          for data handling details.
        </p>
      </main>
    </div>
  );
}
