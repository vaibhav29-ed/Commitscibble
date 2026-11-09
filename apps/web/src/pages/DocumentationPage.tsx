import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  FileText,
  FolderGit2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useRepositories } from "../lib/query";
import {
  Button,
  EmptyState,
  IconTile,
  PageHeader,
  Panel,
  Pill,
  StatusPill,
  Toolbar,
} from "../components/ui";
import { relativeTime, shortSha } from "../lib/format";

type Filter = "all" | "CURRENT" | "STALE" | "NONE" | "PENDING_REVIEW";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "CURRENT", label: "Current" },
  { id: "PENDING_REVIEW", label: "Review needed" },
  { id: "STALE", label: "Stale" },
  { id: "NONE", label: "No docs" },
];

/**
 * Documentation overview backed by the persisted repository records. The API
 * exposes documentation state per repository (status, last successful update,
 * README URL, pending proposal); this screen does not invent document bodies.
 */
export default function DocumentationPage() {
  const repositories = useRepositories();
  const [filter, setFilter] = useState<Filter>("all");

  const connected = repositories.data?.connected ?? [];
  const visible =
    filter === "all" ? connected : connected.filter((repo) => repo.documentationStatus === filter);
  const documented = connected.filter((repo) => repo.lastSuccessfulRunAt);
  const pending = connected.filter((repo) => repo.pendingProposalId);

  return (
    <div>
      <PageHeader
        eyebrow="Documentation studio"
        icon={FileText}
        title="Documentation"
        description="README state for every connected repository, derived from persisted runs. Generate or update a document from its repository workspace."
        actions={
          <Button
            icon={RefreshCw}
            loading={repositories.isFetching}
            onClick={() => repositories.refetch()}
          >
            Refresh
          </Button>
        }
      />

      <div className="stagger mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile label="Documented repositories" value={documented.length} hint="At least one successful update" />
        <SummaryTile label="Waiting for review" value={pending.length} hint="Proposals not yet approved" />
        <SummaryTile
          label="Outdated"
          value={connected.filter((repo) => repo.documentationStatus === "STALE").length}
          hint="Changed since the last update"
        />
      </div>

      <Toolbar>
        <div className="inline-flex flex-wrap rounded-[10px] bg-[var(--surface-3)] p-0.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`cursor-pointer rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                filter === item.id
                  ? "bg-[#251f19] text-white dark:bg-[#f5f2ec] dark:text-[#251f19]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-[var(--text-secondary)]">
          {visible.length} of {connected.length} repositories
        </span>
      </Toolbar>

      {repositories.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="card h-24 animate-pulse bg-[var(--surface-3)]" />
          ))}
        </div>
      ) : repositories.isError ? (
        <Panel>
          <p className="text-[13px] text-rose-600 dark:text-rose-400">
            Repositories could not be loaded.{" "}
            {repositories.error instanceof Error ? repositories.error.message : ""}
          </p>
        </Panel>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={connected.length === 0 ? FolderGit2 : FileText}
          title={connected.length === 0 ? "No repositories connected" : "Nothing in this state"}
          body={
            connected.length === 0
              ? "Connect a repository to generate and maintain its README."
              : "No connected repository matches this documentation state."
          }
          action={
            <Link to="/dashboard/repositories">
              <Button icon={FolderGit2}>
                {connected.length === 0 ? "Connect a repository" : "Open repositories"}
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((repo) => (
            <article key={repo.id} className="card interactive-lift flex flex-col p-5">
              <div className="flex items-start gap-3">
                <IconTile icon={FileText} tone={repo.documentationStatus === "CURRENT" ? "green" : "dark"} />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/dashboard/repositories/${repo.id}`}
                    className="block truncate text-[15px] font-medium text-[var(--text-primary)] transition-colors hover:text-[#0000ee]"
                  >
                    {repo.fullName}
                  </Link>
                  <div className="truncate font-mono text-[11px] text-[var(--text-secondary)]">
                    {repo.settings.readmePath}
                  </div>
                </div>
                <StatusPill value={repo.documentationStatus} />
              </div>

              <p className="mt-3 line-clamp-2 min-h-[34px] text-[12px] leading-relaxed text-[var(--text-secondary)]">
                {repo.description || "No description on GitHub."}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                <span>
                  Last update:{" "}
                  {repo.lastSuccessfulRunAt ? relativeTime(repo.lastSuccessfulRunAt) : "never"}
                </span>
                <span className="font-mono">{shortSha(repo.lastProcessedCommitSha)}</span>
                {repo.pendingProposalId ? (
                  <Pill tone="warn" icon={ShieldCheck}>
                    proposal pending
                  </Pill>
                ) : null}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--border-soft)] pt-3">
                <Link to={`/dashboard/repositories/${repo.id}`}>
                  <Button size="sm" variant="secondary">
                    Open workspace
                  </Button>
                </Link>
                {repo.pendingProposalRunId ? (
                  <Link to={`/dashboard/reviews/${repo.pendingProposalRunId}`}>
                    <Button size="sm">Review proposal</Button>
                  </Link>
                ) : null}
                <a
                  href={repo.readmeUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[#0000ee] hover:underline dark:text-[#8ea2ff]"
                >
                  README <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</p>
      <p className="mt-2 font-display text-[30px] font-medium leading-none text-[var(--text-primary)]">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{hint}</p>
    </div>
  );
}
