import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  FolderGit2,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import type { AvailableRepository } from "@commitscibble/shared";
import { useConnectRepository, useRepositories } from "../lib/query";
import { DisconnectRepository, RepoActions } from "../components/repo-actions";
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

type Scope = "all" | "connected" | "available";

export default function RepositoriesPage() {
  const repositories = useRepositories();
  const connect = useConnectRepository();
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<"all" | "public" | "private">("all");
  const [scope, setScope] = useState<Scope>("all");

  const connected = repositories.data?.connected ?? [];
  const available = (repositories.data?.available ?? []).filter(
    (repo) => !repo.connectedRepositoryId,
  );

  const matches = (repo: { fullName: string; private: boolean }) =>
    (query === "" || repo.fullName.toLowerCase().includes(query.trim().toLowerCase())) &&
    (visibility === "all" || (visibility === "private" ? repo.private : !repo.private));

  const visibleConnected = useMemo(
    () => (scope === "available" ? [] : connected.filter(matches)),
    [connected, query, visibility, scope],
  );
  const visibleAvailable = useMemo(
    () => (scope === "connected" ? [] : available.filter(matches)),
    [available, query, visibility, scope],
  );
  const totalVisible = visibleConnected.length + visibleAvailable.length;

  return (
    <div>
      <PageHeader
        eyebrow="Repository management"
        icon={FolderGit2}
        title="Your repositories"
        description="Repositories this GitHub account can access. Connect the ones CommitScibble should analyse, document, and watch for changes."
        actions={
          <Button
            icon={RefreshCw}
            loading={repositories.isFetching}
            onClick={() => repositories.refetch()}
          >
            Refresh from GitHub
          </Button>
        }
      />

      {repositories.data?.githubError ? (
        <div className="tone-warn mb-5 flex items-start gap-3 rounded-[14px] px-4 py-3 text-[12px] leading-relaxed">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Your GitHub repository list is unavailable</p>
            <p className="mt-0.5">{repositories.data.githubError}</p>
            <Link to="/dashboard/settings" className="mt-1 inline-block font-medium underline">
              Reconnect GitHub authorization
            </Link>
          </div>
        </div>
      ) : null}

      <Toolbar>
        <label className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search repositories by name"
            className="dash-input pl-8"
            aria-label="Search repositories"
          />
        </label>
        <select
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as typeof visibility)}
          className="dash-input w-auto"
          aria-label="Filter by visibility"
        >
          <option value="all">All visibility</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
        <div className="inline-flex rounded-[10px] bg-[var(--surface-3)] p-0.5">
          {(
            [
              ["all", "All"],
              ["connected", "Connected"],
              ["available", "Available"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              className={`cursor-pointer rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                scope === value
                  ? "bg-[#251f19] text-white dark:bg-[#f5f2ec] dark:text-[#251f19]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-[var(--text-secondary)]">
          {repositories.isPending
            ? "Loading…"
            : `${totalVisible} of ${connected.length + available.length}`}
        </span>
      </Toolbar>

      {repositories.isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <div
              key={key}
              className="card h-56 animate-pulse bg-[var(--surface-3)] p-5"
            />
          ))}
        </div>
      ) : totalVisible === 0 && connected.length + available.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No repositories loaded"
          body="Refresh from GitHub to fetch the repositories this account can access. If the list stays empty, your authorization may not include any repositories."
          action={
            <Button icon={RefreshCw} onClick={() => repositories.refetch()}>
              Refresh from GitHub
            </Button>
          }
        />
      ) : totalVisible === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          body="No repositories match these filters. Clear the search or change the filters."
        />
      ) : (
        <div className="space-y-8">
          {visibleConnected.length > 0 ? (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="dash-h3">Connected</h2>
                <Pill tone="success">{visibleConnected.length}</Pill>
              </div>
              <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">
                {visibleConnected.map((repo) => (
                  <article key={repo.id} className="card interactive-lift flex flex-col p-5">
                    <div className="flex items-start gap-3">
                      <IconTile icon={FolderGit2} tone="orange" />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/dashboard/repositories/${repo.id}`}
                          className="block max-w-full truncate text-[15px] font-medium text-[var(--text-primary)] transition-colors hover:text-[#0000ee]"
                        >
                          {repo.name}
                        </Link>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {repo.owner}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Pill icon={repo.private ? Lock : Globe}>
                          {repo.private ? "private" : "public"}
                        </Pill>
                        <StatusPill value={repo.trackingStatus} />
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 min-h-[38px] text-[13px] leading-relaxed text-[var(--text-secondary)]">
                      {repo.description || "No description on GitHub."}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#f48d16]" />
                        {repo.defaultBranch}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {repo.lastSuccessfulRunAt
                          ? `Updated ${relativeTime(repo.lastSuccessfulRunAt)}`
                          : "Never updated"}
                      </span>
                      <span className="font-mono">
                        {shortSha(repo.lastProcessedCommitSha)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusPill value={repo.documentationStatus} />
                      <a
                        href={repo.readmeUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0000ee] hover:underline dark:text-[#8ea2ff]"
                      >
                        Open README <ArrowUpRight className="h-3 w-3" />
                      </a>
                    </div>

                    {repo.lastRun ? (
                      <p className="mt-2 truncate text-[11px] text-[var(--text-secondary)]">
                        Last run: {repo.lastRun.operation.toLowerCase().replaceAll("_", " ")} ·{" "}
                        {repo.lastRun.status.toLowerCase()}
                        {repo.lastRun.errorMessage ? ` — ${repo.lastRun.errorMessage}` : ""}
                      </p>
                    ) : null}

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-4">
                      <RepoActions repository={repo} showReview />
                      <DisconnectRepository repository={repo} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {visibleAvailable.length > 0 ? (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="dash-h3">Available on GitHub</h2>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    Returned by your current authorization and verified against GitHub.
                  </p>
                </div>
                <Pill>{visibleAvailable.length}</Pill>
              </div>
              <Panel className="p-0">
                <ul className="max-h-[560px] divide-y divide-[var(--border-soft)] overflow-y-auto dash-scroll">
                  {visibleAvailable.slice(0, 200).map((repo) => (
                    <AvailableRow
                      key={repo.githubRepoId}
                      repo={repo}
                      onConnect={() => connect.mutate(repo.githubRepoId)}
                      loading={connect.isPending && connect.variables === repo.githubRepoId}
                    />
                  ))}
                </ul>
              </Panel>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AvailableRow({
  repo,
  onConnect,
  loading,
}: {
  repo: AvailableRepository;
  onConnect: () => void;
  loading: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3" data-testid="available-repository">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
          {repo.fullName}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <Pill icon={repo.private ? Lock : Globe}>
            {repo.private ? "private" : "public"}
          </Pill>
          <span className="font-mono">{repo.defaultBranch}</span>
          {repo.description ? <span className="truncate">· {repo.description}</span> : null}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onConnect} loading={loading}>
        <Plus className="h-3.5 w-3.5" /> Connect
      </Button>
    </li>
  );
}
