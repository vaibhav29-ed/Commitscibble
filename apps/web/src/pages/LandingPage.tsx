import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  FileText,
  GitBranch,
  Github,
  Lock,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Wand2,
} from "lucide-react";
import { Logo } from "../components/shell";
import { Badge, Button, CheckLine } from "../components/ui";
import { API_URL } from "../lib/api";
import { useTheme } from "../lib/theme";
import { useMe } from "../lib/query";

const FEATURES = [
  {
    icon: FileText,
    title: "Grounded README generation",
    description:
      "CommitScibble inspects manifests, entry points, scripts, routes, and configuration examples, then writes a README whose commands and paths trace back to real files.",
  },
  {
    icon: GitBranch,
    title: "Incremental patch updates",
    description:
      "A push is compared against the last processed commit. Only sections affected by the change are proposed — installation, deployment, and licensing stay untouched when they are still accurate.",
  },
  {
    icon: Wand2,
    title: "Cleanup and restructuring",
    description:
      "Merge duplicate sections, fix heading structure, and remove filler while a guard verifies every documented command and environment variable survives the rewrite.",
  },
  {
    icon: ShieldCheck,
    title: "Review before write",
    description:
      "Proposals include a unified diff, per-section explanations, validation warnings, and the exact base commit. Nothing is committed until you approve it (unless you opt into automatic mode).",
  },
  {
    icon: Activity,
    title: "Live activity and audit trail",
    description:
      "Every operation emits real progress events with correlated job and log identifiers. History is persisted in MongoDB, so reloading or reconnecting never loses context.",
  },
  {
    icon: Lock,
    title: "Least-privilege GitHub access",
    description:
      "OAuth tokens are encrypted with AES-256-GCM, never exposed to the browser, and can be revoked from account settings. Webhooks are verified with HMAC-SHA256 over the raw payload.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Connect GitHub",
    description:
      "Authorize CommitScibble with the minimum scopes it needs, then pick the repositories you want documented. Access is re-verified against your GitHub permissions.",
  },
  {
    number: "02",
    title: "Generate from real code",
    description:
      "Choose a repository and generate a README. The engine reports exactly which files it inspected and explicitly flags anything it could not verify.",
  },
  {
    number: "03",
    title: "Stay current",
    description:
      "Connect a webhook and every push is classified. Targeted proposals arrive for review, and applying one commits only the documentation change.",
  },
];

const FAQS = [
  {
    question: "Will CommitScibble overwrite my existing README?",
    answer:
      "Repositories default to review mode. Generated or patched documentation is stored as a proposal with a unified diff and base commit; the README changes only when you approve. Automatic mode is opt-in per repository and can be paused at any time.",
  },
  {
    question: "What repository content is sent to the AI provider?",
    answer:
      "A bounded set of relevant files: manifests, configuration examples with values never read, entry points, and source files selected by importance. Secrets, .env files containing values, binaries, and build output are excluded. You choose the provider and model through deployment configuration.",
  },
  {
    question: "How does it avoid rewriting unrelated sections?",
    answer:
      "Changes are classified by comparing git diffs with derived facts such as scripts, environment variable names, routes, and dependency changes. Sections are mapped to the files that justify them. If a code change cannot be tied to a section, CommitScibble preserves the README instead of inventing an update.",
  },
  {
    question: "What happens if I edit the README myself while a proposal is open?",
    answer:
      "Approval re-fetches the README and compares its content hash with the proposal's base. If the file changed, the proposal is marked stale and you are asked to regenerate instead of silently overwriting your edit.",
  },
  {
    question: "Can I remove my data?",
    answer:
      "Disconnecting a repository stops webhook processing and marks its integration inactive. Revoking the GitHub authorization deletes the stored token, ends your sessions, and disconnects all repositories. Audit records are retained for the configured retention window, then removed by a database TTL index.",
  },
  {
    question: "Is there a pricing plan?",
    answer:
      "This deployment does not include billing. No paid plans, prices, or usage quotas are advertised or enforced, and the API rejects billing calls as disabled.",
  },
];

export default function LandingPage() {
  const { theme, toggle } = useTheme();
  const me = useMe();
  const signedIn = Boolean(me.data?.user);
  const connectHref = signedIn ? "/dashboard" : `${API_URL}/auth/github`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-xs text-muted-foreground md:flex" aria-label="Landing">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#security" className="hover:text-foreground">Security</a>
            <Link to="/docs" className="hover:text-foreground">Docs</Link>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {signedIn ? (
              <Link to="/dashboard">
                <Button size="sm">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/signin" className="hidden sm:block">
                  <Button variant="ghost" size="sm">Sign in</Button>
                </Link>
                <a href={connectHref}>
                  <Button size="sm">
                    <Github className="h-3.5 w-3.5" /> Connect GitHub
                  </Button>
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-grid bg-[size:48px_48px] opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
              <div>
                <Badge tone="accent" className="mb-5">
                  <Sparkles className="h-3 w-3" /> AI documentation automation
                </Badge>
                <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
                  Your code evolves.
                  <br />
                  <span className="text-muted-foreground">Your docs follow.</span>
                </h1>
                <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  CommitScibble reads your repository, writes README documentation grounded in
                  actual source files, and patches only the sections a push made outdated. Preview
                  every change before it reaches a branch.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <a href={connectHref}>
                    <Button size="md">
                      <Github className="h-4 w-4" /> Connect GitHub
                    </Button>
                  </a>
                  <a href="#how-it-works">
                    <Button variant="outline" size="md">
                      See how it works <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
                <p className="mt-4 text-2xs text-muted-foreground">
                  Review mode by default. Tokens encrypted at rest. Disconnect and revoke at any time.
                </p>
              </div>

              <ProductPreview />
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Capabilities</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Documentation that is maintained, not just generated
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Each part of the pipeline produces something you can inspect: evidence, diffs,
              validation results, and correlated logs.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="surface p-5">
                <feature.icon className="h-5 w-5 text-accent" />
                <h3 className="mt-3 text-sm font-semibold">{feature.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Workflow</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Three steps, no doc drift</h2>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.number} className="surface p-5">
                  <span className="font-mono text-xs text-accent">{step.number}</span>
                  <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Security and privacy</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Built for repositories you cannot afford to leak
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                These are implementation facts, not certifications. Every claim below is enforced
                by the code in this repository and can be verified in the source.
              </p>
              <div className="mt-5">
                <Link to="/docs">
                  <Button variant="outline" size="sm">
                    Read the security notes <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              <CheckLine>OAuth tokens stored with AES-256-GCM; decrypted only inside the API or worker process.</CheckLine>
              <CheckLine>No token, session secret, or encryption key is ever sent to the browser.</CheckLine>
              <CheckLine>Webhook payloads verified with HMAC-SHA256 and constant-time comparison.</CheckLine>
              <CheckLine>Session cookies are HttpOnly, SameSite=Lax, and Secure in production.</CheckLine>
              <CheckLine>CSRF double-submit protection on every mutating cookie-authenticated request.</CheckLine>
              <CheckLine>Secret files and .env values are excluded from analysis before any AI call.</CheckLine>
              <CheckLine>Repository text is treated as untrusted data; prompts are hardened against injection.</CheckLine>
              <CheckLine>Review mode keeps writes behind explicit approval, with stale-proposal detection.</CheckLine>
            </ul>
          </div>
        </section>

        <section id="faq" className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Questions developers actually ask</h2>
            <div className="mt-6 space-y-2">
              {FAQS.map((faq) => (
                <details key={faq.question} className="surface group p-4">
                  <summary className="cursor-pointer list-none text-sm font-medium">
                    <span className="flex items-center justify-between gap-4">
                      {faq.question}
                      <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="surface flex flex-col items-start justify-between gap-5 p-7 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Start with one repository</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Connect GitHub, generate a README, and review the diff before anything is written.
              </p>
            </div>
            <a href={connectHref}>
              <Button>
                <Github className="h-4 w-4" /> Connect GitHub
              </Button>
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-2xs text-muted-foreground">Your code evolves. Your docs follow.</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-2xs text-muted-foreground">
            <Link to="/docs" className="hover:text-foreground">Documentation</Link>
            <a href="#security" className="hover:text-foreground">Security</a>
            <a
              href="https://docs.github.com/en/rest"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-foreground"
            >
              GitHub API
            </a>
            <span>No analytics or tracking scripts on this page.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-border" />
          <span className="h-2 w-2 rounded-full bg-border" />
          <span className="h-2 w-2 rounded-full bg-border" />
        </div>
        <span className="text-2xs text-muted-foreground">Interface preview</span>
        <Badge tone="outline">Review</Badge>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs">your-org/your-repo</p>
            <p className="mt-0.5 text-2xs text-muted-foreground">main · README.md · proposal pending</p>
          </div>
          <Badge tone="warning">Review needed</Badge>
        </div>

        <div className="rounded-md border border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Affected sections
            </span>
            <span className="text-2xs text-muted-foreground">2 changes</span>
          </div>
          <div className="divide-y divide-border">
            {[
              { icon: Search, label: "Installation", detail: "package manager changed" },
              { icon: RefreshCw, label: "Configuration", detail: "new environment variable" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3 px-3 py-2">
                <row.icon className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs">{row.label}</span>
                <span className="ml-auto text-2xs text-muted-foreground">{row.detail}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-code-bg font-mono text-2xs leading-5">
          <div className="border-b border-border bg-muted/60 px-3 py-1.5 text-muted-foreground">
            README.md · unified diff
          </div>
          <div className="px-3 py-2">
            <p className="text-muted-foreground">@@ -18,4 +18,4 @@</p>
            <p className="text-danger">-npm install</p>
            <p className="text-success">+pnpm install</p>
            <p className="text-success">+CACHE_TTL=</p>
            <p className="text-muted-foreground"> Run the development server:</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-2xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Base commit verified
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Reject</Button>
            <Button size="sm">Approve</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
