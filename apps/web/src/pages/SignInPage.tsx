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
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Logo />
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-14">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to CommitScibble</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Continue with GitHub to connect repositories and review documentation proposals.
        </p>

        {errorMessage ? (
          <div className="mt-5 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <Card className="mt-6">
          <CardContent className="space-y-5">
            <a href={`${API_URL}/auth/github`} className="block">
              <Button className="w-full" size="md">
                <Github className="h-4 w-4" /> Continue with GitHub
              </Button>
            </a>

            <div className="space-y-2 text-2xs text-muted-foreground">
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

            <div className="flex items-start gap-2 border-t border-border pt-4 text-2xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <p>
                Access tokens are stored encrypted with AES-256-GCM and never returned to the
                browser. You can revoke the authorization at any time from account settings.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-2xs text-muted-foreground">
          By signing in you agree to let CommitScibble process repository content with the AI
          provider configured by this deployment. See{" "}
          <Link to="/docs" className="underline underline-offset-2 hover:text-foreground">
            the documentation
          </Link>{" "}
          for data handling details.
        </p>
      </main>
    </div>
  );
}
