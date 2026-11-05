import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  GitBranch,
  Github,
  Lock,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  Wand2,
} from "lucide-react";
import { Logo } from "../components/shell";
import { Badge, Button } from "../components/ui";
import { Greeting } from "../lab/greeting";
import { API_URL } from "../lib/api";
import { cn } from "../lib/cn";
import { useTheme } from "../lib/theme";
import { useMe } from "../lib/query";
import { useInView } from "../lib/use-in-view";

const FEATURES = [
  {
    icon: FileText,
    title: "Grounded README generation",
    description:
      "CommitScibble inspects manifests, entry points, scripts, routes, and configuration examples, then writes a README whose commands and paths trace back to real files.",
    accent: true,
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
      "Proposals include a unified diff, per-section explanations, validation warnings, and the exact base commit. Nothing is committed until you approve it.",
  },
  {
    icon: Activity,
    title: "Live activity and audit trail",
    description:
      "Every operation emits real progress events with correlated job and log identifiers. History is persisted, so reloading or reconnecting never loses context.",
  },
  {
    icon: Lock,
    title: "Least-privilege GitHub access",
    description:
      "OAuth tokens are encrypted with AES-256-GCM, never exposed to the browser, and can be revoked from account settings. Webhooks are verified with HMAC-SHA256.",
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

const STATS = [
  { value: "100%", label: "Review-first by default" },
  { value: "AES-256", label: "Token encryption at rest" },
  { value: "0", label: "Unrelated sections rewritten" },
  { value: "1 commit", label: "Per approved change" },
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
  const workflow = useInView<HTMLDivElement>();
  const signedIn = Boolean(me.data?.user);
  const connectHref = signedIn ? "/dashboard" : `${API_URL}/auth/github`;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-8">
          <Logo />
          <nav
            className="hidden items-center gap-1 rounded-full border border-border bg-card p-1 md:flex"
            aria-label="Landing"
          >
            {[
              ["#features", "Features"],
              ["#how-it-works", "How it works"],
              ["#security", "Security"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3.5 py-1.5 text-xs font-light text-muted-foreground transition-colors duration-150 ease-smooth hover:bg-muted hover:text-foreground"
              >
                {label}
              </a>
            ))}
            <Link
              to="/docs"
              className="rounded-full px-3.5 py-1.5 text-xs font-light text-muted-foreground transition-colors duration-150 ease-smooth hover:bg-muted hover:text-foreground"
            >
              Docs
            </Link>
          </nav>
          <div className="flex items-center gap-1.5">
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
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
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
        {/* Hero — Taste Skill deal hero--collage: text on span-5, UI collage on
            span-6 start-7, on a lit ground, window cut by the frame's right and
            bottom edges, one small result card over the lower-left. */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-hero-fade" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-dot-grid opacity-30 [mask-image:radial-gradient(ellipse_55%_45%_at_50%_0%,black,transparent_72%)]"
          />
          <div className="relative mx-auto max-w-content px-8 pb-28 pt-20 lg:pb-[208px] lg:pt-[192px]">
            <div className="grid items-start gap-16 lg:grid-cols-12">
              <div className="flex flex-col items-start gap-5 lg:col-span-5">
                <Greeting name="Developer" className="flex items-center gap-2.5" />
                <h1 className="type-display text-balance text-foreground animate-motion-headline-in">
                  Your code evolves.
                  <br />
                  <span className="text-gradient-brand">Your docs follow.</span>
                </h1>
                <p className="type-body mt-2 max-w-md text-pretty text-muted-foreground">
                  CommitScibble reads your repository, writes README documentation grounded in actual
                  source files, and patches only the sections a push made outdated. Preview every
                  change before it reaches a branch.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <a href={connectHref} className="inline-flex">
                    <Button size="md" className="h-11 px-6">
                      <Github className="h-4 w-4" /> Connect GitHub
                    </Button>
                  </a>
                  <a href="#how-it-works" className="inline-flex">
                    <Button variant="outline" size="md" className="h-11">
                      See how it works <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
                <p className="mt-5 text-2xs font-light text-muted-foreground">
                  Review mode by default · Tokens encrypted at rest · Disconnect and revoke at any
                  time
                </p>
              </div>

              <div className="lg:col-start-7 lg:col-span-6">
                <ProductPreview />
              </div>
            </div>
          </div>
        </section>

        {/* Stats strip — hairline cells on the measured border. */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-content px-8">
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="bg-card px-4 py-10">
                  <p className="font-display text-3xl font-normal leading-none tracking-[-0.032em] text-foreground tabular-nums">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-2xs font-light leading-relaxed text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-content px-8 py-24 lg:py-36">
          <SectionIntro
            title="Documentation that is maintained, not just generated"
            description="Each part of the pipeline produces something you can inspect: evidence, diffs, validation results, and correlated logs."
          />

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className={cn(
                  "group relative flex flex-col rounded-xl border p-6 shadow-card transition-[transform,border-color,box-shadow] duration-150 ease-smooth",
                  feature.accent
                    ? "border-brand-200 bg-brand-gradient-soft"
                    : "border-border bg-card hover:-translate-y-0.5 hover:border-brand-200",
                )}
              >
                <div
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-md border",
                    feature.accent
                      ? "border-white/25 bg-brand-gradient text-white shadow-glow-sm"
                      : "border-brand-200 bg-card text-brand-600",
                  )}
                >
                  <feature.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-5 font-display text-base font-normal tracking-[-0.032em] text-foreground">
                  {feature.title}
                </h3>
                <p className="type-body mt-2 text-muted-foreground">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works — measured 144px section padding. */}
        <section id="how-it-works" className="relative border-y border-border bg-muted/50">
          <div className="mx-auto max-w-content px-8 py-24 lg:py-36">
            <SectionIntro
              title="Three steps, no doc drift"
              description="From authorization to a reviewed diff, every step leaves a trail you can verify."
            />

            <div className="relative mt-14 grid gap-6 md:mt-16 md:grid-cols-3 md:gap-8">
              <div
                ref={workflow.ref}
                aria-hidden
                className="pointer-events-none absolute left-[16%] right-[16%] top-5 hidden h-px overflow-hidden bg-border md:block"
              >
                <span
                  className="block h-px w-1/3 animate-line-pulse bg-gradient-to-r from-transparent via-brand-400 to-transparent"
                  style={{ animationPlayState: workflow.inView ? "running" : "paused" }}
                />
              </div>
              {STEPS.map((step) => (
                <div
                  key={step.number}
                  className="relative rounded-xl border border-border bg-card p-5 shadow-card"
                >
                  <div className="relative z-10 grid h-10 w-10 place-items-center rounded-md border border-brand-400 bg-card font-display text-sm text-brand-700 shadow-subtle dark:text-brand-300">
                    {step.number}
                  </div>
                  <h3 className="mt-5 font-display text-base font-normal tracking-[-0.032em] text-foreground">
                    {step.title}
                  </h3>
                  <p className="type-body mt-2 text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="mx-auto max-w-content px-8 py-24 lg:py-36">
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <h2 className="type-title-md text-balance text-foreground">
                Built for repositories you cannot afford to leak
              </h2>
              <p className="type-body mt-4 max-w-md text-muted-foreground">
                These are implementation facts, not certifications. Every claim below is enforced
                by the code in this repository and can be verified in the source.
              </p>
              <div className="mt-6">
                <Link to="/docs">
                  <Button variant="outline" size="sm">
                    Read the security notes <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative rounded-xl border border-white/25 bg-brand-gradient p-1.5 shadow-glow">
              <div className="relative rounded-lg bg-card p-6 sm:p-8">
                <div className="flex items-center gap-2 text-sm font-normal text-brand-600 dark:text-brand-300">
                  <span className="grid h-7 w-7 place-items-center rounded-md border border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  Enforced in code
                </div>
                <ul className="mt-5 grid gap-3">
                  {[
                    "OAuth tokens stored with AES-256-GCM; decrypted only inside the API or worker process.",
                    "No token, session secret, or encryption key is ever sent to the browser.",
                    "Webhook payloads verified with HMAC-SHA256 and constant-time comparison.",
                    "Session cookies are HttpOnly, SameSite=Lax, and Secure in production.",
                    "CSRF double-submit protection on every mutating cookie-authenticated request.",
                    "Secret files and .env values are excluded from analysis before any AI call.",
                    "Repository text is treated as untrusted data; prompts are hardened against injection.",
                    "Review mode keeps writes behind explicit approval, with stale-proposal detection.",
                  ].map((item) => (
                    <li key={item} className="type-body flex items-start gap-2.5 text-muted-foreground">
                      <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border bg-muted/50">
          <div className="mx-auto max-w-2xl px-8 py-24 lg:py-36">
            <SectionIntro
              title="Questions developers actually ask"
              description="The answers describe what this deployment does, including what it deliberately leaves out."
            />
            <div className="mt-10 space-y-2">
              {FAQS.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-xl border border-border bg-card px-5 shadow-card"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-base font-normal tracking-[-0.032em] text-foreground">
                    {faq.question}
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-[transform,color,border-color] duration-150 ease-smooth group-open:rotate-45 group-open:border-brand-400 group-open:text-brand-600">
                      +
                    </span>
                  </summary>
                  <p className="type-body pb-5 text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-content px-8 py-24 lg:py-36">
          <div className="relative overflow-hidden rounded-xl border border-white/25 bg-brand-gradient px-6 py-14 text-center shadow-glow sm:px-12 lg:py-20">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/50" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="type-title-md text-balance text-white">Start with one repository</h2>
              <p className="type-body mx-auto mt-3 max-w-lg text-white/80">
                Connect GitHub, generate a README, and review the diff before anything is written.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a href={connectHref}>
                  <Button
                    size="md"
                    className="border-white/30 bg-white px-6 text-brand-700 shadow-none hover:bg-white/90"
                  >
                    <Github className="h-4 w-4" /> Connect GitHub
                  </Button>
                </a>
                <Link to="/docs">
                  <Button
                    variant="ghost"
                    size="md"
                    className="border border-white/25 text-white hover:bg-white/10"
                  >
                    Read the docs
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer — measured 80px top / 48px bottom. */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-content px-8 pb-12 pt-20">
          <div className="flex flex-col justify-between gap-10 sm:flex-row">
            <div className="max-w-xs">
              <Logo />
              <p className="type-body mt-4 text-muted-foreground">
                Documentation grounded in your source. Your code evolves, your docs follow.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              <FooterColumn
                title="Product"
                links={[
                  ["#features", "Features"],
                  ["#how-it-works", "How it works"],
                  ["#security", "Security"],
                ]}
              />
              <FooterColumn
                title="Resources"
                links={[
                  ["/docs", "Documentation"],
                  ["/signin", "Sign in"],
                  ["#faq", "FAQ"],
                ]}
              />
              <FooterColumn
                title="External"
                links={[["https://docs.github.com/en/rest", "GitHub API"]]}
                external
              />
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-2xs font-light text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} CommitScibble. All rights reserved.</span>
            <span>No analytics or tracking scripts on this page.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="type-title-md text-balance text-foreground">{title}</h2>
      <p className="type-body mx-auto mt-4 max-w-xl text-muted-foreground">{description}</p>
    </div>
  );
}

function FooterColumn({
  title,
  links,
  external = false,
}: {
  title: string;
  links: [string, string][];
  external?: boolean;
}) {
  return (
    <div>
      <p className="text-2xs font-medium uppercase tracking-[0.14em] text-foreground">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([href, label]) => (
          <li key={href}>
            {external ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs font-light text-muted-foreground transition-colors duration-150 ease-smooth hover:text-foreground"
              >
                {label}
              </a>
            ) : href.startsWith("#") ? (
              <a
                href={href}
                className="text-xs font-light text-muted-foreground transition-colors duration-150 ease-smooth hover:text-foreground"
              >
                {label}
              </a>
            ) : (
              <Link
                to={href}
                className="text-xs font-light text-muted-foreground transition-colors duration-150 ease-smooth hover:text-foreground"
              >
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductPreview() {
  const preview = useInView<HTMLDivElement>({ once: true, threshold: 0.2 });

  return (
    <div
      ref={preview.ref}
      className={cn("relative mx-auto max-w-5xl", preview.inView && "motion-run")}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -bottom-6 -top-6 rounded-2xl bg-brand-gradient opacity-10 blur-2xl"
      />

      <div className="relative overflow-hidden rounded-[20px] min-h-[320px] lg:min-h-[620px]">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 60% at 18% 12%, color-mix(in oklab, #e9e0d2 80%, white), transparent 70%), radial-gradient(60% 50% at 90% 100%, color-mix(in oklab, #d9ccb7 80%, #a8794a), transparent 70%), #d9ccb7",
          }}
        />
        <div className="absolute bottom-0 left-6 top-6 right-[-28px] overflow-hidden rounded-[12px] bg-card lg:left-[64px] lg:top-[64px]">
          <div className="absolute inset-0">
            <div className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
                <span className="h-2 w-2 rounded-full bg-[#28c840]" />
              </div>
              <span className="hidden text-2xs font-light text-muted-foreground sm:block">
                app.commitscibble.dev/reviews
              </span>
              <Badge tone="warning" className="motion-badge">
                Review needed
              </Badge>
            </div>

            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.05fr_1fr] lg:pr-12">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/60 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-foreground">your-org/your-repo</p>
                    <p className="mt-0.5 text-2xs font-light text-muted-foreground">
                      main · README.md · proposal pending
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-2xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Live
                  </span>
                </div>

                <div className="overflow-hidden rounded-md border border-border">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Affected sections
                    </span>
                    <span className="text-2xs font-light text-muted-foreground">2 changes</span>
                  </div>
                  <div className="divide-y divide-border">
                    {[
                      { icon: RefreshCw, label: "Installation", detail: "package manager changed" },
                      { icon: Sparkles, label: "Configuration", detail: "new environment variable" },
                    ].map((row, index) => (
                      <div
                        key={row.label}
                        className="motion-section-flag flex items-center gap-3 px-3 py-2.5"
                        style={{ animationDelay: `${140 + index * 70}ms` }}
                      >
                        <span className="grid h-6 w-6 place-items-center rounded bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                          <row.icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-xs text-foreground">{row.label}</span>
                        <span className="ml-auto text-2xs font-light text-muted-foreground">
                          {row.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/60 p-2.5">
                  <div className="flex items-center gap-1.5 text-2xs font-light text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-success" />
                    Diff scoped to 2 sections
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Reject
                    </Button>
                    <Button size="sm">Approve</Button>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-md border border-border bg-code-bg font-mono text-2xs leading-5">
                <div className="flex items-center justify-between border-b border-border bg-muted/60 px-3 py-2 text-muted-foreground">
                  <span>README.md · unified diff</span>
                  <span className="text-brand-600 dark:text-brand-300">+4 −1</span>
                </div>
                <div className="relative px-3 py-3">
                  <span aria-hidden className="motion-scan" />
                  <div className="space-y-0.5">
                    {[
                      { line: "@@ -18,4 +18,4 @@", tone: "hunk" },
                      { line: "-npm install", tone: "remove" },
                      { line: "+pnpm install", tone: "add" },
                      { line: "+CACHE_TTL=", tone: "add" },
                      { line: " Run the development server:", tone: "plain" },
                      { line: "+pnpm dev", tone: "add" },
                      { line: "@@ -31,2 +31,2 @@", tone: "hunk" },
                      { line: " ## Configuration", tone: "plain" },
                      { line: "+| CACHE_TTL | Cache lifetime |", tone: "add" },
                    ].map((row, index) => (
                      <p
                        key={row.line}
                        data-tone={row.tone}
                        className={cn(
                          "motion-diff-line whitespace-pre-wrap break-all px-1",
                          row.tone === "add" && "rounded bg-success/10 text-success",
                          row.tone === "remove" && "rounded bg-danger/10 text-danger",
                          row.tone === "hunk" && "text-muted-foreground",
                          row.tone === "plain" && "text-muted-foreground",
                        )}
                        style={
                          row.tone === "plain" ? undefined : { animationDelay: `${100 + index * 24}ms` }
                        }
                      >
                        {row.line}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="motion-stamp flex items-center gap-2 border-t border-border px-3 py-2 text-muted-foreground">
                  <span className="motion-verified h-1.5 w-1.5 rounded-full bg-success" />
                  Validation passed · 0 warnings
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-[64px] left-[64px] z-10 hidden w-[300px] motion-loop-card lg:block">
          <div className="rounded-[12px] border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-sm text-foreground">Proposal pending</p>
              <Badge tone="warning">Review needed</Badge>
            </div>
            <p className="type-body mt-2 text-sm text-muted-foreground">
              Diff scoped to 2 sections · validation passed, 0 warnings.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8">
                Reject
              </Button>
              <Button size="sm" className="h-8">
                Approve
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
