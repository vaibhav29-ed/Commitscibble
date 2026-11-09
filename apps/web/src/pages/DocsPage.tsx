import { Link } from "react-router-dom";
import { ArrowLeft, GitBranch, Lock, ServerCog } from "lucide-react";
import { Logo } from "../components/shell";
import { Button, IconTile, Panel, Pill } from "../components/ui";
import { API_URL } from "../lib/api";
import { useMe } from "../lib/query";

const SECTIONS = [
  {
    icon: GitBranch,
    title: "Connect and generate",
    body: [
      "Sign in with GitHub, open Repositories, and connect a repository from the list of repositories your account can access.",
      "Use Generate README to analyse the default branch (or your configured target branch) and produce a proposal. Review mode is on by default, so nothing is written until you approve.",
      "Use Run update to compare the branch head against the last processed commit without waiting for a webhook.",
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
  const me = useMe();
  const connectHref = me.data?.user ? "/dashboard" : `${API_URL}/auth/github`;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6">
        <div className="glass-nav mx-auto flex max-w-[1200px] items-center justify-between rounded-[14px] border px-4 py-2.5 shadow-[0_10px_32px_rgba(37,31,25,0.08)]">
          <Logo />
          <div className="flex items-center gap-2">
            <Link to="/" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-3.5 w-3.5" /> Home
              </Button>
            </Link>
            <a href={connectHref}>
              <Button size="sm">{me.data?.user ? "Dashboard" : "Connect GitHub"}</Button>
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1000px] px-4 pb-24 pt-12 sm:px-6 lg:pt-16">
        <div className="max-w-2xl">
          <Pill tone="warn">Documentation</Pill>
          <h1 className="dash-title mt-4 text-balance">How CommitScibble works</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.75] text-[var(--text-secondary)]">
            CommitScibble keeps a README tied to the code it documents. This page covers the
            operator-facing behaviour; deployment and API details live in the repository README and
            docs directory.
          </p>
        </div>

        <div className="mt-10 grid gap-4">
          {SECTIONS.map((section) => (
            <Panel key={section.title}>
              <div className="flex items-center gap-3">
                <IconTile icon={section.icon} tone="dark" size="sm" />
                <h2 className="dash-h3 text-[20px]">{section.title}</h2>
              </div>
              <div className="mt-4 space-y-3">
                {section.body.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-[14px] leading-[1.7] text-[var(--text-secondary)]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </Panel>
          ))}
        </div>

        <Panel className="mt-4">
          <h2 className="dash-h3 text-[20px]">What CommitScibble will not do</h2>
          <ul className="mt-4 space-y-2 text-[14px] leading-[1.7] text-[var(--text-secondary)]">
            <li>
              · It will not invent package commands, environment variables, endpoints, or licenses
              that are absent from the repository.
            </li>
            <li>
              · It will not overwrite a README that changed after a proposal was generated (the
              proposal is marked stale).
            </li>
            <li>· It will not execute commands or code produced by a language model.</li>
            <li>
              · It will not silently skip failed GitHub or AI operations; failures surface in the
              run and activity log.
            </li>
          </ul>
        </Panel>

        <div className="mt-10 text-center text-[13px] text-[var(--text-secondary)]">
          <Link
            to={me.data?.user ? "/dashboard" : "/signin"}
            className="font-medium text-[#0000ee] underline underline-offset-4 dark:text-[#8ea2ff]"
          >
            {me.data?.user ? "Open your workspace" : "Sign in with GitHub"}
          </Link>{" "}
          to connect your first repository.
        </div>
      </main>
    </div>
  );
}
