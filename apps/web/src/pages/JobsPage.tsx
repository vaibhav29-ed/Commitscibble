import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  Cpu,
  FolderGit2,
  ListTodo,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import type { RunStatus, RunSummary } from "@commitscibble/shared";
import { useCancelRun, useRepositories, useRepositoryRuns, useReviewActions } from "../lib/query";
import { operationLabel } from "../components/activity";
import {
  Button,
  EmptyState,
  IconTile,
  PageHeader,
  Panel,
  Pill,
  StatusPill,
} from "../components/ui";
import { relativeTime, shortSha } from "../lib/format";

const STATUSES: RunStatus[] = ["QUEUED", "RUNNING", "RETRYING", "SUCCEEDED", "FAILED", "CANCELLED"];

interface RunWithRepository {
  run: RunSummary;
  repositoryId: string;
  repositoryFullName: string;
}

/**
 * Runs are exposed per repository by the API, so this screen aggregates the
 * latest runs for each connected repository. It reflects real worker state and
 * never fabricates progress percentages.
 */
export default function JobsPage() {
  const repositories = useRepositories();
  const connected = repositories.data?.connected ?? [];
  const results = useRepositoryRuns(connected);
  const cancel = useCancelRun();
  const { retry } = useReviewActions();
  const [filter, setFilter] = useState<RunStatus | "all">("all");

  const runs: RunWithRepository[] = results
    .flatMap((result) =>
      result.runs.map((run) => ({
        run,
        repositoryId: result.repository.id,
        repositoryFullName: result.repository.fullName,
      })),
    )
    .sort(
      (a, b) => new Date(b.run.createdAt).getTime() - new Date(a.run.createdAt).getTime(),
    );
  const visible = filter === "all" ? runs : runs.filter((item) => item.run.status === filter);
  const loading = repositories.isPending || results.some((result) => result.isLoading);
  const failedToLoad = results.filter((result) => result.isError);

  return (
    <div>
      <PageHeader
        eyebrow="Background tasks"
        icon={ListTodo}
        title="Background jobs"
        description="Documentation runs queued and executed by the worker. Each card is a persisted run with its real status and error information."
        actions={
          <Button
            icon={RefreshCw}
            loading={repositories.isFetching || loading}
            onClick={() => repositories.refetch()}
          >
            Refresh
          </Button>
        }
      />

      <div className="stagger mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATUSES.map((status) => {
          const count = runs.filter((item) => item.run.status === status).length;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(filter === status ? "all" : status)}
              className={`card cursor-pointer p-4 text-left transition-all ${
                filter === status ? "ring-2 ring-[#f48d16]/60" : "hover:-translate-y-0.5"
              }`}
            >
              <StatusPill value={status} />
              <div className="mt-3 font-display text-[26px] font-medium leading-none text-[var(--text-primary)]">
                {count}
              </div>
            </button>
          );
        })}
      </div>

      {failedToLoad.length > 0 ? (
        <Panel className="mb-4">
          <p className="text-[12px] text-rose-600 dark:text-rose-400">
            Runs could not be loaded for{" "}
            {failedToLoad.map((result) => result.repository.fullName).join(", ")}.{" "}
            {failedToLoad[0].error instanceof Error ? failedToLoad[0].error.message : ""}
          </p>
        </Panel>
      ) : null}

      {repositories.isPending || loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="card h-28 animate-pulse bg-[var(--surface-3)]" />
          ))}
        </div>
      ) : connected.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No repositories connected"
          body="Connect a repository and start a documentation run to see jobs here."
          action={
            <Link to="/dashboard/repositories">
              <Button icon={FolderGit2}>Browse repositories</Button>
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title={filter === "all" ? "No runs yet" : `No ${filter.toLowerCase()} runs`}
          body="Analyse a repository or generate documentation to queue a background run."
          action={
            <Button onClick={() => setFilter("all")} variant="outline">
              Show all statuses
            </Button>
          }
        />
      ) : (
        <div className="stagger space-y-3">
          {visible.map(({ run, repositoryId, repositoryFullName }) => {
            const active = ["QUEUED", "RUNNING", "RETRYING"].includes(run.status);
            return (
              <Panel key={`${repositoryId}:${run.id}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <IconTile
                    icon={active ? Cpu : ListTodo}
                    tone={run.status === "FAILED" ? "rose" : active ? "orange" : "dark"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-[var(--text-primary)]">
                        {operationLabel(run.operation)}
                      </span>
                      <StatusPill value={run.status} />
                      {run.attempt > 1 ? <Pill>attempt {run.attempt}</Pill> : null}
                      {run.provider ? (
                        <Pill tone="info">
                          {run.provider}/{run.model ?? "model"}
                        </Pill>
                      ) : null}
                    </div>
                    <Link
                      to={`/dashboard/repositories/${repositoryId}`}
                      className="mt-0.5 inline-block font-mono text-[12px] text-[#0000ee] hover:underline dark:text-[#8ea2ff]"
                    >
                      {repositoryFullName}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Queued {relativeTime(run.createdAt)}
                      </span>
                      <span>Updated {relativeTime(run.updatedAt)}</span>
                      {run.appliedCommitSha ? (
                        <span className="font-mono">{shortSha(run.appliedCommitSha)}</span>
                      ) : run.baseCommitSha ? (
                        <span className="font-mono">base {shortSha(run.baseCommitSha)}</span>
                      ) : null}
                    </div>
                    {run.errorMessage ? (
                      <div className="tone-danger mt-2 rounded-[10px] px-3 py-2 text-[12px]">
                        {run.errorCode ? `${run.errorCode}: ` : ""}
                        {run.errorMessage}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {active ? (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={cancel.isPending && cancel.variables === run.id}
                        onClick={() => cancel.mutate(run.id)}
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    ) : null}
                    {run.status === "FAILED" ? (
                      <Button
                        size="sm"
                        variant="accent"
                        loading={retry.isPending && retry.variables === run.id}
                        onClick={() =>
                          retry.mutate(run.id, {
                            onSuccess: () => repositories.refetch(),
                          })
                        }
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    ) : null}
                    <Link to={`/dashboard/reviews/${run.id}`}>
                      <Button size="sm" variant="secondary">
                        {run.proposalId ? "Review" : "Details"}
                      </Button>
                    </Link>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
