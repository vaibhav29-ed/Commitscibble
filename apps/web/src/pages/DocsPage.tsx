import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, GitBranch, Lock, ServerCog } from "lucide-react";
import { Logo } from "../components/shell";
import { Badge } from "../components/ui";

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
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Logo />
          <Link to="/" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12">
        <Badge tone="outline">
          <BookOpen className="h-3 w-3" /> Product documentation
        </Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">How CommitScibble works</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          CommitScibble keeps a README tied to the code it documents. This page covers the
          operator-facing behaviour; deployment and API details live in the repository README and
          docs directory.
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title} className="surface p-6">
              <div className="flex items-center gap-2">
                <section.icon className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold">{section.title}</h2>
              </div>
              <div className="mt-3 space-y-2">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-xs leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-8 surface p-6">
          <h2 className="text-sm font-semibold">What CommitScibble will not do</h2>
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <li>· It will not invent package commands, environment variables, endpoints, or licenses that are absent from the repository.</li>
            <li>· It will not overwrite a README that changed after a proposal was generated (the proposal is marked stale).</li>
            <li>· It will not execute commands or code produced by a language model.</li>
            <li>· It will not silently skip failed GitHub or AI operations; failures surface in the run and activity log.</li>
          </ul>
        </section>

        <div className="mt-8 text-xs text-muted-foreground">
          <Link to="/signin" className="underline underline-offset-2 hover:text-foreground">
            Sign in with GitHub
          </Link>{" "}
          to connect your first repository.
        </div>
      </main>
    </div>
  );
}
