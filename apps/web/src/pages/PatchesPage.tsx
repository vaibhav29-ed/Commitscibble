import { Link } from "react-router-dom";
import {
  CheckCircle2,
  FolderGit2,
  GitPullRequest,
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
} from "../components/ui";
import { relativeTime } from "../lib/format";

export default function PatchesPage() {
  const repositories = useRepositories();
  const connected = repositories.data?.connected ?? [];
  const pending = connected.filter((repo) => repo.pendingProposalId && repo.pendingProposalRunId);
  const needsAttention = connected.filter(
    (repo) => repo.documentationStatus === "STALE" || repo.documentationStatus === "PENDING_REVIEW",
  );

  return (
    <div>
      <PageHeader
        eyebrow="Documentation patches"
        icon={GitPullRequest}
        title="Review patches"
        description="Proposed documentation updates waiting for approval. Nothing is written to GitHub until a proposal is approved."
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

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-[11px] font-medium text-[var(--text-secondary)]">Pending proposals</p>
          <p className="mt-2 font-display text-[30px] font-medium leading-none text-[var(--text-primary)]">
            {pending.length}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Awaiting review</p>
        </div>
        <div className="card p-5">
          <p className="text-[11px] font-medium text-[var(--text-secondary)]">Repositories needing attention</p>
          <p className="mt-2 font-display text-[30px] font-medium leading-none text-[var(--text-primary)]">
            {needsAttention.length}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Stale or review pending</p>
        </div>
        <div className="card p-5">
          <p className="text-[11px] font-medium text-[var(--text-secondary)]">Connected repositories</p>
          <p className="mt-2 font-display text-[30px] font-medium leading-none text-[var(--text-primary)]">
            {connected.length}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Under automation</p>
        </div>
      </div>

      {repositories.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="card h-28 animate-pulse bg-[var(--surface-3)]" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No proposals waiting"
          body="Generated documentation that requires review appears here. Create one with Generate README or Run update from a repository workspace."
          action={
            <Link to="/dashboard/repositories">
              <Button icon={FolderGit2}>Open repositories</Button>
            </Link>
          }
        />
      ) : (
        <div className="stagger space-y-3">
          {pending.map((repo) => (
            <Panel key={repo.id}>
              <div className="flex flex-wrap items-start gap-3">
                <IconTile icon={ShieldCheck} tone="blue" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/dashboard/repositories/${repo.id}`}
                      className="truncate text-[14px] font-medium text-[var(--text-primary)] hover:underline"
                    >
                      {repo.fullName}
                    </Link>
                    <Pill tone="warn">proposal pending</Pill>
                    {repo.lastRun ? <Pill>{repo.lastRun.operation.toLowerCase()}</Pill> : null}
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                    {repo.settings.readmePath} · target{" "}
                    <span className="font-mono">
                      {repo.settings.targetBranch ?? repo.defaultBranch}
                    </span>{" "}
                    · update mode {repo.settings.updateMode.toLowerCase()}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {repo.lastSuccessfulRunAt
                      ? `Last successful update ${relativeTime(repo.lastSuccessfulRunAt)}`
                      : "No successful update yet"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/dashboard/reviews/${repo.pendingProposalRunId}`}>
                    <Button size="sm">Review diff</Button>
                  </Link>
                  <Link to={`/dashboard/repositories/${repo.id}`}>
                    <Button size="sm" variant="outline">
                      Workspace
                    </Button>
                  </Link>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {needsAttention.length > 0 ? (
        <Panel className="mt-5">
          <h2 className="dash-h3">Other repositories needing attention</h2>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
            These repositories do not have a pending proposal, but their documentation state
            suggests a run may be useful.
          </p>
          <ul className="mt-3 divide-y divide-[var(--border-soft)]">
            {needsAttention.map((repo) => (
              <li key={repo.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <Link
                    to={`/dashboard/repositories/${repo.id}`}
                    className="truncate text-[13px] font-medium text-[var(--text-primary)] hover:underline"
                  >
                    {repo.fullName}
                  </Link>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {repo.documentationStatus.toLowerCase().replaceAll("_", " ")} ·{" "}
                    {repo.lastSuccessfulRunAt
                      ? `updated ${relativeTime(repo.lastSuccessfulRunAt)}`
                      : "never updated"}
                  </p>
                </div>
                <Link to={`/dashboard/repositories/${repo.id}`}>
                  <Button size="sm" variant="ghost">
                    Open workspace
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
