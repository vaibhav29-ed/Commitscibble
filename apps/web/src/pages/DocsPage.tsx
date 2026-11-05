import { Link } from "react-router-dom";
import { ArrowLeft, GitBranch, Lock, ServerCog } from "lucide-react";
import { Logo } from "../components/shell";

const SECTIONS = [
  {
    icon: GitBranch,
    title: "Connect and generate",
    body: [
      "Sign in with GitHub, open Repositories, and connect a repository from the list of repositories your account can access.",
      "Use Generate README to analyse the default branch (or your configured target branch) and produce a proposal. Review mode is on by default, so nothing is written until you approve.",
      "Use Run incremental update to compare the branch head against the last processed commit without waiting for a webhook.",
    ],
  },
  {
    icon: ServerCog,
    title: "Automation and settings",
    body: [
      "Each repository has its own README path, target branch, update mode, ignore rules, maintained sections, and commit message template.",
      "Automatic mode applies validated proposals immediately; review mode stores them for approval. Pausing tracking stops webhook-triggered runs while keeping manual actions available.",
      "Configure the GitHub webhook to POST to /api/v1/webhooks/github with the same secret as GITHUB_WEBHOOK_SECRET. Deliveries are deduplicated by X-GitHub-Delivery.",
    ],
  },
  {
    icon: Lock,
    title: "Data handling",
    body: [
      "Only a bounded, filtered subset of repository files is sent to the configured AI provider. Secret files, environment files with values, binaries, and build artifacts are excluded.",
      "Tokens are encrypted with AES-256-GCM using TOKEN_ENCRYPTION_KEY. Sessions are HttpOnly cookies with CSRF protection, and every mutating API call is authorized per resource.",
      "Audit records and webhook delivery records expire according to AUDIT_RETENTION_DAYS and WEBHOOK_RETENTION_DAYS. Repository content is not stored wholesale.",
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Logo />
          <Link
            to="/"
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-16 lg:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="type-display mt-5 text-balance">How CommitScibble works</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            CommitScibble keeps a README tied to the code it documents. This page covers the
            operator-facing behaviour; deployment and API details live in the repository README and
            docs directory.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-2xl gap-4">
          {SECTIONS.map((section) => (
            <section key={section.title} className="rounded-xl border border-border bg-card p-6 shadow-subtle sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand-200/70 bg-brand-50 text-primary dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
                  <section.icon className="h-4 w-4" />
                </span>
                <h2 className="type-title-md">{section.title}</h2>
              </div>
              <div className="mt-4 space-y-2.5">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-base leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mx-auto mt-4 max-w-2xl rounded-xl border border-border bg-muted/50 p-6 sm:p-8">
          <h2 className="type-title-md">What CommitScibble will not do</h2>
          <ul className="mt-4 space-y-2 text-base leading-relaxed text-muted-foreground">
            <li>· It will not invent package commands, environment variables, endpoints, or licenses that are absent from the repository.</li>
            <li>· It will not overwrite a README that changed after a proposal was generated (the proposal is marked stale).</li>
            <li>· It will not execute commands or code produced by a language model.</li>
            <li>· It will not silently skip failed GitHub or AI operations; failures surface in the run and activity log.</li>
          </ul>
        </section>

        <div className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
          <Link
            to="/signin"
            className="font-medium text-primary underline underline-offset-4 hover:underline dark:text-brand-300"
          >
            Sign in with GitHub
          </Link>{" "}
          to connect your first repository.
        </div>
      </main>
    </div>
  );
}
