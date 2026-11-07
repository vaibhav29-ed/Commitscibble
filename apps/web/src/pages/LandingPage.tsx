import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Menu, X } from "lucide-react";
import { Logo } from "../components/shell";
import { cn } from "../lib/cn";
import { Button } from "../components/ui";
import { API_URL } from "../lib/api";
import { useMe } from "../lib/query";

const FEATURES = [
  {
    title: "Grounded README generation",
    description:
      "CommitScibble inspects manifests, entry points, scripts, routes, and configuration examples, then writes a README whose commands and paths trace back to real files.",
  },
  {
    title: "Incremental patch updates",
    description:
      "A push is compared against the last processed commit. Only sections affected by the change are proposed — installation, deployment, and licensing stay untouched when they are still accurate.",
  },
  {
    title: "Cleanup and restructuring",
    description:
      "Merge duplicate sections, fix heading structure, and remove filler while a guard verifies every documented command and environment variable survives the rewrite.",
  },
  {
    title: "Review before write",
    description:
      "Proposals include a unified diff, per-section explanations, validation warnings, and the exact base commit. Nothing is committed until you approve it.",
  },
  {
    title: "Live activity and audit trail",
    description:
      "Every operation emits real progress events with correlated job and log identifiers. History is persisted, so reloading or reconnecting never loses context.",
  },
  {
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

const SECURITY = [
  "OAuth tokens stored with AES-256-GCM; decrypted only inside the API or worker process.",
  "No token, session secret, or encryption key is ever sent to the browser.",
  "Webhook payloads verified with HMAC-SHA256 and constant-time comparison.",
  "Session cookies are HttpOnly, SameSite=Lax, and Secure in production.",
  "CSRF double-submit protection on every mutating cookie-authenticated request.",
  "Secret files and .env values are excluded from analysis before any AI call.",
  "Repository text is treated as untrusted data; prompts are hardened against injection.",
  "Review mode keeps writes behind explicit approval, with stale-proposal detection.",
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

const HERO_TAGS = ["Review-first", "AES-256 at rest", "HMAC-SHA256 webhooks", "GitHub native"];

const NAV_LINKS: [string, string][] = [
  ["#features", "Features"],
  ["#how-it-works", "How it works"],
  ["#security", "Security"],
  ["#faq", "FAQ"],
];

const SECTION_IDS = NAV_LINKS.map(([href]) => href.slice(1));

/**
 * Tracks which in-page section occupies the band just below the sticky bar.
 * The band stops short of the viewport's lower half so the link flips when a
 * section actually becomes the one being read, not when it first peeks in.
 */
function useActiveSection(ids: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    if (sections.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Document order, so overlapping sections resolve predictably.
        setActiveId(ids.find((id) => visible.has(id)) ?? null);
      },
      { rootMargin: "-72px 0px -55% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [ids]);

  return activeId;
}

export default function LandingPage() {
  const me = useMe();
  const signedIn = Boolean(me.data?.user);
  const connectHref = signedIn ? "/dashboard" : `${API_URL}/auth/github`;
  const [navOpen, setNavOpen] = useState(false);
  const activeSection = useActiveSection(SECTION_IDS);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto grid h-16 max-w-content grid-cols-[1fr_auto] items-center gap-4 px-6 sm:px-8 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center">
            <Logo />
          </div>

          <nav
            className="hidden items-center gap-0.5 justify-self-center rounded-full border border-border bg-card p-1 shadow-subtle lg:flex"
            aria-label="Landing"
          >
            {NAV_LINKS.map(([href, label]) => {
              const isActive = activeSection === href.slice(1);
              return (
                <a
                  key={href}
                  href={href}
                  aria-current={isActive ? "location" : undefined}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ease-smooth",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {label}
                </a>
              );
            })}
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <Link
              to="/docs"
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 ease-smooth hover:bg-muted hover:text-foreground"
            >
              Docs
            </Link>
          </nav>

          <div className="flex items-center justify-end gap-2">
            {signedIn ? (
              <Link to="/dashboard" className="hidden sm:block">
                <Button size="sm">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/signin" className="hidden sm:block">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <a href={connectHref} className="hidden sm:block">
                  <Button size="sm">Connect GitHub</Button>
                </a>
              </>
            )}
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors duration-150 ease-smooth hover:bg-muted hover:text-foreground lg:hidden"
              onClick={() => setNavOpen((open) => !open)}
              aria-label={navOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={navOpen}
              aria-controls="landing-nav-mobile"
            >
              {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {navOpen ? (
          <div
            id="landing-nav-mobile"
            className="motion-fade-in border-t border-border bg-card lg:hidden"
          >
            <nav className="mx-auto grid max-w-content gap-1 px-6 pb-6 pt-3 sm:px-8" aria-label="Landing">
              {NAV_LINKS.map(([href, label]) => {
                const isActive = activeSection === href.slice(1);
                return (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setNavOpen(false)}
                    aria-current={isActive ? "location" : undefined}
                    className={cn(
                      "rounded-md px-2.5 py-2.5 text-sm font-medium transition-colors duration-150 ease-smooth",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {label}
                  </a>
                );
              })}
              <Link
                to="/docs"
                onClick={() => setNavOpen(false)}
                className="rounded-md px-2.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-smooth hover:bg-muted hover:text-foreground"
              >
                Documentation
              </Link>
              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-4">
                {signedIn ? (
                  <Link to="/dashboard" onClick={() => setNavOpen(false)}>
                    <Button className="w-full">Dashboard</Button>
                  </Link>
                ) : (
                  <>
                    <a href={connectHref} onClick={() => setNavOpen(false)}>
                      <Button className="w-full">Connect GitHub</Button>
                    </a>
                    <Link to="/signin" onClick={() => setNavOpen(false)}>
                      <Button variant="ghost" className="w-full">
                        Sign in
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main>
        {/* Hero: painted desert backdrop, reference scale, real review screen. */}
        <section className="relative isolate overflow-hidden bg-inverse text-inverse-foreground">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 scale-105 bg-[url('/brand/hero-background.png')] bg-cover bg-center bg-no-repeat"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/65 via-black/55 to-black/85"
          />
          <div className="mx-auto max-w-content px-6 pb-0 pt-16 sm:px-8 lg:pt-24">
            <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
              <ul className="flex flex-wrap items-center justify-center gap-2" aria-label="Product facts">
                {HERO_TAGS.map((tag) => (
                  <li
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/70"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-400" aria-hidden />
                    {tag}
                  </li>
                ))}
              </ul>

              <h1 className="type-display mt-8 text-balance text-white">
                Your code evolves.
                <br />
                Your docs follow.
              </h1>

              <p className="mt-6 max-w-2xl text-pretty text-[17px] leading-[1.75] text-white/65">
                CommitScibble reads your repository, writes README documentation grounded in actual
                source files, and patches only the sections a push made outdated. Preview every
                change before it reaches a branch.
              </p>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <a href={connectHref} className="inline-flex">
                  <Button
                    size="md"
                    className="h-11 border-0 bg-white px-6 text-[#171717] shadow-none hover:bg-white/90"
                  >
                    Connect GitHub
                  </Button>
                </a>
                <a href="#how-it-works" className="inline-flex">
                  <Button
                    variant="ghost"
                    size="md"
                    className="h-11 border border-white/25 px-6 text-white hover:border-white/40 hover:bg-white/10"
                  >
                    See how it works
                  </Button>
                </a>
              </div>

              <p className="mt-6 text-[13px] text-white/50">
                Review mode by default · Tokens encrypted at rest · Disconnect and revoke at any
                time
              </p>
            </div>

            <div className="mx-auto mt-14 max-w-5xl lg:mt-20">
              <div className="overflow-hidden rounded-t-xl border border-b-0 border-white/15 bg-white p-1.5 shadow-overlay sm:p-2">
                <img
                  src="/product/review.png"
                  alt="CommitScibble review screen: a README proposal split into Installation and Configuration sections, with the unified diff, validation result and approve action."
                  width={1152}
                  height={800}
                  className="block h-auto w-full rounded-lg"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Proof strip: the concrete numbers behind the claims. */}
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-content px-6 sm:px-8">
            <dl className="grid grid-cols-2 divide-x divide-y divide-border border-border sm:grid-cols-4 sm:divide-y-0">
              {STATS.map((stat) => (
                <div key={stat.label} className="px-5 py-9 sm:px-6 sm:py-10">
                  <dd className="font-display text-[32px] font-extrabold leading-none tracking-normal text-foreground tabular-nums">
                    {stat.value}
                  </dd>
                  <dt className="mt-2 text-[13px] leading-5 text-muted-foreground">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Features: a measured card grid with plain text, no icon tiles. */}
        <section id="features" className="bg-background">
          <div className="mx-auto max-w-content px-6 py-20 sm:px-8 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-4">
                <p className="type-label text-brand-600 dark:text-brand-300">What it does</p>
                <h2 className="type-title-lg mt-3 text-balance text-foreground">
                  Documentation that is maintained, not just generated
                </h2>
                <p className="type-body mt-4 max-w-sm text-muted-foreground">
                  Each part of the pipeline produces something you can inspect: evidence, diffs,
                  validation results, and correlated logs.
                </p>
              </div>
              <ol className="grid gap-3 sm:grid-cols-2 lg:col-span-8">
                {FEATURES.map((feature, index) => (
                  <li
                    key={feature.title}
                    className="interactive-card rounded-xl border border-border bg-card p-5 shadow-subtle sm:p-6"
                  >
                    <span className="font-mono text-[13px] text-brand-600 dark:text-brand-300">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-3 text-[17px] font-semibold leading-snug text-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
                      {feature.description}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* How it works: the single dark band, as three steps on the measured surface. */}
        <section
          id="how-it-works"
          className="relative isolate overflow-hidden border-y border-white/10 bg-inverse text-inverse-foreground"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 scale-105 bg-[url('/brand/hero-background.png')] bg-cover bg-center bg-no-repeat"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/65 via-black/55 to-black/85"
          />
          <div className="mx-auto max-w-content px-6 py-20 sm:px-8 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-4">
                <p className="type-label text-brand-300">How it works</p>
                <h2 className="type-title-lg mt-3 text-balance text-white">Three steps, no doc drift</h2>
                <p className="type-body mt-4 max-w-sm text-white/60">
                  From authorization to a reviewed diff, every step leaves a trail you can verify.
                </p>
              </div>
              <ol className="grid gap-3 lg:col-span-8">
                {STEPS.map((step) => (
                  <li
                    key={step.number}
                    className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:grid-cols-[3.5rem_12rem_1fr] sm:items-start sm:gap-6 sm:p-6"
                  >
                    <span className="font-display text-[22px] font-extrabold leading-none text-brand-300 tabular-nums">
                      {step.number}
                    </span>
                    <h3 className="text-[17px] font-semibold leading-snug text-white">{step.title}</h3>
                    <p className="text-[15px] leading-[1.65] text-white/60">{step.description}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Security: a split proof block of implementation facts. */}
        <section id="security" className="bg-card">
          <div className="mx-auto max-w-content px-6 py-20 sm:px-8 lg:py-28">
            <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
              <div className="lg:sticky lg:top-24">
                <p className="type-label text-brand-600 dark:text-brand-300">Security</p>
                <h2 className="type-title-lg mt-3 text-balance text-foreground">
                  Built for repositories you cannot afford to leak
                </h2>
                <p className="type-body mt-4 max-w-md text-muted-foreground">
                  These are implementation facts, not certifications. Every claim below is enforced
                  by the code in this repository and can be verified in the source.
                </p>
                <div className="mt-6">
                  <Link to="/docs">
                    <Button variant="outline" size="sm">
                      Read the security notes
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-6 shadow-subtle sm:p-8">
                <p className="type-label text-brand-600 dark:text-brand-300">Enforced in code</p>
                <ul className="mt-4">
                  {SECURITY.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 border-t border-border py-3 text-[15px] leading-[1.6] text-muted-foreground first:border-t-0 first:pt-0"
                    >
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                        <Check className="h-3 w-3" strokeWidth={3} />
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
        <section id="faq" className="border-t border-border bg-background">
          <div className="mx-auto max-w-content px-6 py-20 sm:px-8 lg:py-28">
            <div className="max-w-3xl">
              <p className="type-label text-brand-600 dark:text-brand-300">FAQ</p>
              <h2 className="type-title-lg mt-3 text-balance text-foreground">
                Questions developers actually ask
              </h2>
              <p className="type-body mt-4 max-w-xl text-muted-foreground">
                The answers describe what this deployment does, including what it deliberately
                leaves out.
              </p>
            </div>
            <div className="mt-10 max-w-3xl space-y-2">
              {FAQS.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-xl border border-border bg-card px-5 shadow-subtle"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-medium leading-snug text-foreground [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground transition-[transform,color,border-color] duration-150 ease-smooth group-open:rotate-45 group-open:border-brand-400 group-open:text-brand-600 dark:group-open:border-brand-500 dark:group-open:text-brand-300">
                      +
                    </span>
                  </summary>
                  <p className="pb-5 text-[15px] leading-[1.65] text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Close: the reference 44px dark feature panel. */}
        <section className="bg-background pb-20 lg:pb-28">
          <div className="mx-auto max-w-content px-6 sm:px-8">
            <div className="relative isolate overflow-hidden rounded-3xl bg-inverse px-6 py-14 text-center text-inverse-foreground sm:px-12 lg:py-20">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 scale-105 bg-[url('/brand/hero-background.png')] bg-cover bg-center bg-no-repeat"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/65 via-black/55 to-black/85"
              />
              <h2 className="type-title-lg text-balance text-white">Start with one repository</h2>
              <p className="mx-auto mt-3 max-w-lg text-[17px] leading-[1.75] text-white/60">
                Connect GitHub, generate a README, and review the diff before anything is written.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a href={connectHref}>
                  <Button
                    size="md"
                    className="h-11 border-0 bg-white px-6 text-[#171717] shadow-none hover:bg-white/90"
                  >
                    Connect GitHub
                  </Button>
                </a>
                <Link to="/docs">
                  <Button
                    variant="ghost"
                    size="md"
                    className="h-11 border border-white/25 px-6 text-white hover:border-white/40 hover:bg-white/10"
                  >
                    Read the docs
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-content px-6 pb-12 pt-16 sm:px-8">
          <div className="flex flex-col justify-between gap-10 sm:flex-row">
            <div className="max-w-xs">
              <Logo />
              <p className="mt-4 text-[15px] leading-[1.65] text-muted-foreground">
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
          <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} CommitScibble. All rights reserved.</span>
            <span>No analytics or tracking scripts on this page.</span>
          </div>
        </div>
      </footer>
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
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([href, label]) => (
          <li key={href}>
            {external ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[13px] text-muted-foreground transition-colors duration-150 ease-smooth hover:text-foreground"
              >
                {label}
              </a>
            ) : href.startsWith("#") ? (
              <a
                href={href}
                className="text-[13px] text-muted-foreground transition-colors duration-150 ease-smooth hover:text-foreground"
              >
                {label}
              </a>
            ) : (
              <Link
                to={href}
                className="text-[13px] text-muted-foreground transition-colors duration-150 ease-smooth hover:text-foreground"
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
