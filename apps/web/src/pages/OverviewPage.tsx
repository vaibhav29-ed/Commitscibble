import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  FileText,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useActivity, useMe, useRepositories } from "../lib/query";
import { useRealtimeStatus } from "../lib/realtime";
import {
  ActivityTimeline,
  operationLabel,
} from "../components/activity";
import {
  Button,
  EmptyState,
  IconTile,
  Panel,
  PanelTitle,
  Pill,
  ProgressBar,
  StatusPill,
  type IconType,
} from "../components/ui";
import { relativeTime, shortSha } from "../lib/format";

const HERO_IMAGE = "/brand/landing/hero-bg.png";

function documentationPercent(status: string): number {
  if (status === "CURRENT") return 100;
  if (status === "PENDING_REVIEW") return 65;
  if (status === "STALE") return 40;
  return 0;
}

export default function OverviewPage() {
  const me = useMe();
  const repositories = useRepositories();
  const activity = useActivity({ pageSize: 50 });
  const realtime = useRealtimeStatus();
  const navigate = useNavigate();

  const connected = repositories.data?.connected ?? [];
  const available = repositories.data?.available ?? [];
  const tracked = connected.filter((repo) => repo.trackingStatus === "CONNECTED");
  const pending = connected.filter((repo) => repo.pendingProposalId);
  const running = connected.filter((repo) =>
    repo.lastRun ? ["QUEUED", "RUNNING", "RETRYING"].includes(repo.lastRun.status) : false,
  );
  const events = activity.data?.items ?? [];
  const successes = events.filter((event) => event.type === "SUCCESS").length;
  const failures = events.filter((event) => event.type === "FAILED").length;
  const documented = connected
    .filter((repo) => repo.lastSuccessfulRunAt)
    .sort(
      (a, b) =>
        new Date(b.lastSuccessfulRunAt ?? 0).getTime() -
        new Date(a.lastSuccessfulRunAt ?? 0).getTime(),
    );

  const user = me.data?.user;
  const firstName = (user?.displayName || user?.githubLogin || "there").split(" ")[0];
  const coverage = connected.length
    ? Math.round(
        connected.reduce(
          (sum, repo) => sum + documentationPercent(repo.documentationStatus),
          0,
        ) / connected.length,
      )
    : 0;

  const summary = !repositories.isPending
    ? connected.length === 0
      ? "Connect a repository to start analysing it and generating grounded documentation."
      : `${connected.length} connected repositor${connected.length === 1 ? "y" : "ies"}, ${pending.length} proposal${pending.length === 1 ? "" : "s"} waiting for review, and ${running.length} run${running.length === 1 ? "" : "s"} in the queue.`
    : "Loading your repository workspace…";

  const stats: {
    label: string;
    value: string | number | null;
    hint: string;
    icon: IconType;
    tone: "orange" | "dark" | "blue" | "green" | "rose";
    to: string;
  }[] = [
    {
      label: "Connected repositories",
      value: repositories.isPending ? null : connected.length,
      hint: `${tracked.length} tracking active`,
      icon: FolderGit2,
      tone: "orange",
      to: "/dashboard/repositories",
    },
    {
      label: "Pending reviews",
      value: repositories.isPending ? null : pending.length,
      hint: "Proposals waiting for approval",
      icon: GitPullRequest,
      tone: "blue",
      to: "/dashboard/patches",
    },
    {
      label: "Running jobs",
      value: repositories.isPending ? null : running.length,
      hint: running[0]?.lastRun ? operationLabel(running[0].lastRun.operation) : "Queue idle",
      icon: Cpu,
      tone: "dark",
      to: "/dashboard/jobs",
    },
    {
      label: "Recent failures",
      value: activity.isPending ? null : failures,
      hint: "In the latest 50 activity events",
      icon: XCircle,
      tone: "rose",
      to: "/dashboard/activity?status=FAILED",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[24px] border border-white/20 shadow-[var(--shadow-float)]">
        <img
          src={HERO_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="banner-wash absolute inset-0" />
        <div className="relative z-10 flex flex-col justify-between gap-8 p-6 sm:p-10 lg:flex-row lg:items-end">
          <div className="stagger max-w-[580px]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[12px] font-medium text-white backdrop-blur-md">
              <span className="live-dot" />
              {running.length
                ? `${running.length} job${running.length === 1 ? "" : "s"} running now`
                : realtime === "convex"
                  ? "Workspace live"
                  : "Workspace polling"}
            </div>
            <h1 className="font-display text-[36px] font-semibold leading-[1.04] tracking-[-0.035em] text-white drop-shadow-[0_2px_16px_rgba(37,31,25,0.3)] sm:text-[52px]">
              Welcome back, {firstName}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-white/85">{summary}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                variant="light"
                size="lg"
                icon={FolderGit2}
                onClick={() => navigate("/dashboard/repositories")}
              >
                Browse repositories
              </Button>
              <Button
                variant="glass"
                size="lg"
                icon={FileText}
                onClick={() => navigate("/dashboard/docs")}
              >
                Documentation
              </Button>
            </div>
          </div>

          <div className="w-full rounded-[18px] border border-white/25 bg-white/12 p-4 text-white backdrop-blur-xl lg:w-[320px]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12px] font-medium">Documentation coverage</span>
              <span className="text-[11px] text-white/65">
                {coverage}% current
              </span>
            </div>
            {connected.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-white/75">
                Coverage appears after you connect and document a repository.
              </p>
            ) : (
              <ul className="space-y-3">
                {connected.slice(0, 4).map((repo) => {
                  const value = documentationPercent(repo.documentationStatus);
                  return (
                    <li key={repo.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/repositories/${repo.id}`)}
                        className="group w-full cursor-pointer text-left"
                      >
                        <div className="mb-1 flex justify-between text-[11px]">
                          <span className="truncate group-hover:underline">{repo.fullName}</span>
                          <span className="font-mono-code">{value}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                          <div
                            className="progress-fill h-full rounded-full"
                            style={{ width: `${Math.max(2, value)}%` }}
                          />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {repositories.data?.githubError ? (
        <div className="tone-warn flex items-start gap-3 rounded-[14px] px-4 py-3 text-[12px] leading-relaxed">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">GitHub repositories could not be refreshed</p>
            <p className="mt-0.5">{repositories.data.githubError}</p>
            <Link to="/dashboard/settings" className="mt-1 inline-block font-medium underline">
              Reconnect GitHub authorization
            </Link>
          </div>
        </div>
      ) : null}

      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => navigate(stat.to)}
            className="bento-card card flex min-h-[150px] cursor-pointer flex-col justify-between p-5 text-left"
          >
            <div className="flex items-start justify-between">
              <IconTile icon={stat.icon} tone={stat.tone} />
              <ArrowRight className="h-4 w-4 text-[var(--text-secondary)]" />
            </div>
            <div>
              <div className="mt-4 font-display text-[34px] font-medium leading-none tracking-tight text-[var(--text-primary)]">
                {stat.value === null ? "—" : stat.value}
              </div>
              <div className="mt-1.5 text-[12px] font-medium text-[var(--text-primary)]">
                {stat.label}
              </div>
              <div className="truncate text-[11px] text-[var(--text-secondary)]">{stat.hint}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelTitle
            title="Recent repository activity"
            hint="Connections, runs, proposals, and GitHub writes"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/activity")}>
                View all
              </Button>
            }
          />
          {activity.isPending ? (
            <div className="space-y-3">
              <div className="h-10 animate-pulse rounded-[10px] bg-[var(--surface-3)]" />
              <div className="h-10 animate-pulse rounded-[10px] bg-[var(--surface-3)]" />
              <div className="h-10 animate-pulse rounded-[10px] bg-[var(--surface-3)]" />
            </div>
          ) : activity.isError ? (
            <p className="text-[12px] text-rose-600 dark:text-rose-400">
              Activity could not be loaded.{" "}
              {activity.error instanceof Error ? activity.error.message : ""}
            </p>
          ) : (
            <ActivityTimeline
              events={events.slice(0, 7)}
              emptyTitle="No activity yet"
              emptyDescription="Connect, analyse, or generate documentation and the audit trail appears here."
            />
          )}
        </Panel>

        <Panel>
          <PanelTitle
            title="In the queue"
            hint="Live run status"
            icon={Cpu}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/jobs")}>
                Open
              </Button>
            }
          />
          {running.length === 0 ? (
            <p className="text-[12px] text-[var(--text-secondary)]">
              The queue is idle. Start a run from a repository workspace.
            </p>
          ) : (
            <ul className="space-y-3">
              {running.slice(0, 5).map((repo) => (
                <li key={repo.id} className="theme-soft rounded-[14px] border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-medium text-[var(--text-primary)]">
                      {repo.fullName}
                    </span>
                    {repo.lastRun ? <StatusPill value={repo.lastRun.status} /> : null}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-[var(--text-secondary)]">
                    {repo.lastRun ? operationLabel(repo.lastRun.operation) : "Run"} ·{" "}
                    {repo.lastRun ? relativeTime(repo.lastRun.updatedAt) : ""}
                  </div>
                  <ProgressBar value={repo.lastRun?.status === "RUNNING" ? 65 : 15} className="mt-2" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelTitle
            title="Repositories"
            hint="Current documentation state per repository"
            icon={FolderGit2}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/repositories")}>
                Manage
              </Button>
            }
          />
          {repositories.isPending ? (
            <div className="space-y-2">
              <div className="h-12 animate-pulse rounded-[10px] bg-[var(--surface-3)]" />
              <div className="h-12 animate-pulse rounded-[10px] bg-[var(--surface-3)]" />
            </div>
          ) : connected.length === 0 ? (
            <div className="theme-soft rounded-[14px] border p-5 text-center">
              <p className="text-[13px] font-medium text-[var(--text-primary)]">
                No repositories connected
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                {available.length > 0
                  ? `${available.length} repositories are available from your GitHub authorization.`
                  : "Sign in with GitHub to load the repositories your account can access."}
              </p>
              <Button
                size="sm"
                className="mt-3"
                icon={FolderGit2}
                onClick={() => navigate("/dashboard/repositories")}
              >
                Connect a repository
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-soft)]">
              {connected.slice(0, 5).map((repo) => (
                <li key={repo.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/dashboard/repositories/${repo.id}`}
                      className="truncate text-[13px] font-medium text-[var(--text-primary)] hover:underline"
                    >
                      {repo.fullName}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                      <span className="font-mono">{shortSha(repo.lastProcessedCommitSha)}</span>
                      <span>·</span>
                      <span>
                        {repo.lastSuccessfulRunAt
                          ? `updated ${relativeTime(repo.lastSuccessfulRunAt)}`
                          : "no successful update"}
                      </span>
                    </div>
                  </div>
                  <StatusPill value={repo.trackingStatus} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            title="Documentation"
            hint="Latest successful README updates"
            icon={FileText}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/docs")}>
                Open studio
              </Button>
            }
          />
          {documented.length === 0 ? (
            <p className="text-[12px] text-[var(--text-secondary)]">
              No documentation has been generated yet. Generate a README from a repository
              workspace and the result appears here.
            </p>
          ) : (
            <ul className="space-y-2">
              {documented.slice(0, 5).map((repo) => (
                <li key={repo.id}>
                  <Link
                    to={`/dashboard/repositories/${repo.id}`}
                    className="interactive-lift theme-soft flex items-center gap-3 rounded-[14px] border p-3"
                  >
                    <IconTile icon={FileText} tone="dark" size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[11px] text-[var(--text-primary)]">
                          {repo.settings.readmePath}
                        </span>
                        <Pill tone={repo.documentationStatus === "CURRENT" ? "success" : "warn"}>
                          {repo.documentationStatus.toLowerCase().replaceAll("_", " ")}
                        </Pill>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">
                        {repo.fullName} · {relativeTime(repo.lastSuccessfulRunAt)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelTitle
          title="Pending reviews"
          hint="Proposals are applied only after approval when review mode is enabled"
          icon={ShieldCheck}
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/patches")}>
              Review patches
            </Button>
          }
        />
        {pending.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No proposals waiting"
            description="Generated documentation that requires review appears here with its diff and validation results."
          />
        ) : (
          <ul className="divide-y divide-[var(--border-soft)]">
            {pending.map((repo) => (
              <li key={repo.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">
                    {repo.fullName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    {repo.lastSuccessfulRunAt
                      ? `Generated ${relativeTime(repo.lastSuccessfulRunAt)}`
                      : "Proposal pending review"}
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
      </Panel>

      {successes > 0 ? (
        <p className="flex items-center justify-center gap-2 text-[11px] text-[var(--text-secondary)]">
          <Sparkles className="h-3.5 w-3.5 text-[#f48d16]" />
          {successes} successful events recorded across the latest 50 audit entries.
          <GitBranch className="h-3.5 w-3.5" />
        </p>
      ) : null}
    </div>
  );
}
