import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Github,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useActivity, useRepositories } from "../lib/query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Skeleton,
  StatusPill,
} from "../components/ui";
import { ActivityTimeline, RepoStatusSummary, operationLabel } from "../components/activity";
import { relativeTime, shortSha } from "../lib/format";
import { useRealtimeStatus } from "../lib/realtime";

export default function OverviewPage() {
  const repositories = useRepositories();
  const activity = useActivity({ pageSize: 50 });
  const [params] = useSearchParams();
  const welcome = params.get("welcome") === "1";
  const realtime = useRealtimeStatus();

  const connected = repositories.data?.connected ?? [];
  const pendingReviews = connected.filter((repo) => repo.pendingProposalId);
  const events = activity.data?.items ?? [];
  const successes = events.filter((event) => event.type === "SUCCESS").length;
  const failures = events.filter((event) => event.type === "FAILED").length;
  const activeRuns = connected.filter((repo) =>
    repo.lastRun ? ["QUEUED", "RUNNING", "RETRYING"].includes(repo.lastRun.status) : false,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Overview"
        description="Documentation state derived from your connected repositories and persisted activity."
        actions={
          <>
            <Badge tone={realtime === "convex" ? "success" : "outline"}>
              {realtime === "convex" ? "Live updates" : "Polling updates"}
            </Badge>
            <Link to="/dashboard/repositories">
              <Button size="sm" variant="outline">
                <Github className="h-3.5 w-3.5" /> Manage repositories
              </Button>
            </Link>
          </>
        }
      />

      {welcome ? (
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
          <div>
            <p className="text-sm font-medium">GitHub connected</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Connect a repository below, then generate its README. Proposals are created for
              review by default.
            </p>
          </div>
        </div>
      ) : null}

      {repositories.data?.githubError ? (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium">GitHub repositories could not be refreshed</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">{repositories.data.githubError}</p>
            <Link to="/dashboard/settings" className="mt-2 inline-block text-xs text-accent hover:underline">
              Reconnect GitHub authorization
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Connected repositories"
          value={repositories.isPending ? null : String(connected.length)}
          hint={`${connected.filter((repo) => repo.trackingStatus === "CONNECTED").length} tracking active`}
          icon={<Github className="h-4 w-4" />}
        />
        <MetricCard
          label="Pending reviews"
          value={repositories.isPending ? null : String(pendingReviews.length)}
          hint="Proposals waiting for approval"
          icon={<GitBranch className="h-4 w-4" />}
          tone={pendingReviews.length > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Recent successes"
          value={activity.isPending ? null : String(successes)}
          hint="In the latest 50 activity events"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
        <MetricCard
          label="Recent failures"
          value={activity.isPending ? null : String(failures)}
          hint="In the latest 50 activity events"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={failures > 0 ? "danger" : "neutral"}
        />
      </div>

      {activeRuns.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> Runs in progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeRuns.map((repo) => (
              <div key={repo.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{repo.fullName}</span>
                  <span className="text-muted-foreground">
                    {repo.lastRun ? operationLabel(repo.lastRun.operation) : "Run"}
                  </span>
                </div>
                <Link
                  to={`/dashboard/repositories/${repo.id}`}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  View progress
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Repositories</CardTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">Current documentation state per repository</p>
            </div>
            <Link to="/dashboard/repositories" className="text-xs text-accent hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {repositories.isPending ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : connected.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<Github className="h-6 w-6" />}
                  title="No repositories connected"
                  description="Connect a GitHub repository to generate and maintain its documentation."
                  action={
                    <Link to="/dashboard/repositories">
                      <Button size="sm">Connect a repository</Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {connected.slice(0, 6).map((repo) => (
                  <li key={repo.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/dashboard/repositories/${repo.id}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {repo.fullName}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
                        <span className="font-mono">{repo.defaultBranch}</span>
                        <span>·</span>
                        <span>{repo.private ? "Private" : "Public"}</span>
                        <span>·</span>
                        <span>Last commit {shortSha(repo.lastProcessedCommitSha)}</span>
                      </div>
                      <div className="mt-1.5">
                        <RepoStatusSummary
                          documentationStatus={repo.documentationStatus}
                          lastSuccessfulRunAt={repo.lastSuccessfulRunAt}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <StatusPill value={repo.trackingStatus} />
                      <Link
                        to={
                          repo.pendingProposalRunId
                            ? `/dashboard/reviews/${repo.pendingProposalRunId}`
                            : `/dashboard/repositories/${repo.id}`
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                      >
                        {repo.pendingProposalRunId ? "Review proposal" : "Open"}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5" /> Recent activity
              </CardTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Persisted audit events, newest first
              </p>
            </div>
            <Link to="/dashboard/activity" className="text-xs text-accent hover:underline">
              All activity
            </Link>
          </CardHeader>
          <CardContent>
            {activity.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : (
              <ActivityTimeline events={events.slice(0, 7)} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documentation reviews</CardTitle>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Proposals are only applied after approval when review mode is enabled.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {pendingReviews.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<ShieldCheck className="h-6 w-6" />}
                title="No proposals waiting"
                description="Generated documentation that requires review will appear here with its diff and validation results."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {pendingReviews.map((repo) => (
                <li key={repo.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium">{repo.fullName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {repo.lastSuccessfulRunAt
                        ? `Generated ${relativeTime(repo.lastSuccessfulRunAt)}`
                        : "Proposal pending"}
                    </p>
                  </div>
                  <Link to={`/dashboard/reviews/${repo.pendingProposalRunId}`}>
                    <Button size="sm" variant="outline">
                      Review diff
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | null;
  hint: string;
  icon: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "warning"
          ? "text-warning"
          : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="space-y-2.5">
        <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${toneClass}`}>
          {icon}
          {label}
        </div>
        {value === null ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <p className="font-display text-[32px] font-extrabold leading-none tabular-nums tracking-normal">
            {value}
          </p>
        )}
        <p className="text-[13px] leading-[1.5] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
