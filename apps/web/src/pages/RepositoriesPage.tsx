import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Github, Lock, Plus, Search } from "lucide-react";
import { useConnectRepository, useRepositories } from "../lib/query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Skeleton,
  StatusPill,
} from "../components/ui";
import { RepoActions, DisconnectRepository } from "../components/repo-actions";
import { shortSha } from "../lib/format";
import type { AvailableRepository } from "@commitscibble/shared";

export default function RepositoriesPage() {
  const repositories = useRepositories();
  const connect = useConnectRepository();
  const [filter, setFilter] = useState("");
  const [showAvailable, setShowAvailable] = useState(true);

  const connected = repositories.data?.connected ?? [];
  const available = repositories.data?.available ?? [];

  const filteredConnected = useMemo(
    () =>
      connected.filter((repo) =>
        repo.fullName.toLowerCase().includes(filter.trim().toLowerCase()),
      ),
    [connected, filter],
  );
  const filteredAvailable = useMemo(
    () =>
      available.filter(
        (repo) =>
          !repo.connectedRepositoryId &&
          repo.fullName.toLowerCase().includes(filter.trim().toLowerCase()),
      ),
    [available, filter],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-page-title">Repositories</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Connect repositories, run documentation jobs, and control per-repository automation.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter repositories"
            className="pl-8"
            aria-label="Filter repositories"
          />
        </div>
      </div>

      {repositories.data?.githubError ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium">Your GitHub repository list is unavailable</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">{repositories.data.githubError}</p>
            <Link to="/dashboard/settings" className="mt-2 inline-block text-xs text-accent hover:underline">
              Reconnect GitHub
            </Link>
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Connected</h2>
          <Badge tone="outline">{connected.length}</Badge>
        </div>

        {repositories.isPending ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-52 w-full" />
            <Skeleton className="h-52 w-full" />
          </div>
        ) : filteredConnected.length === 0 ? (
          <EmptyState
            icon={<Github className="h-6 w-6" />}
            title={connected.length === 0 ? "No repositories connected yet" : "No matches"}
            description={
              connected.length === 0
                ? "Connect a repository from the GitHub list below to start generating documentation."
                : "No connected repository matches this filter."
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredConnected.map((repo) => (
              <Card key={repo.id} data-testid="connected-repository">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/dashboard/repositories/${repo.id}`}
                        className="truncate text-base font-semibold hover:underline"
                      >
                        {repo.fullName}
                      </Link>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{repo.defaultBranch}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          {repo.private ? <Lock className="h-3 w-3" /> : null}
                          {repo.private ? "Private" : "Public"}
                        </span>
                        <StatusPill value={repo.trackingStatus} />
                      </p>
                    </div>
                    <StatusPill value={repo.documentationStatus} />
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-border bg-muted/30 p-2">
                      <dt className="text-muted-foreground">Last processed commit</dt>
                      <dd className="mt-0.5 font-mono">{shortSha(repo.lastProcessedCommitSha)}</dd>
                    </div>
                    <div className="rounded-md border border-border bg-muted/30 p-2">
                      <dt className="text-muted-foreground">Last successful update</dt>
                      <dd className="mt-0.5">{repo.lastSuccessfulRunAt ? repo.lastSuccessfulRunAt.slice(0, 10) : "Never"}</dd>
                    </div>
                    <div className="col-span-2 rounded-md border border-border bg-muted/30 p-2">
                      <dt className="text-muted-foreground">README</dt>
                      <dd className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate font-mono">{repo.settings.readmePath}</span>
                        <a
                          href={repo.readmeUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="shrink-0 text-accent hover:underline"
                        >
                          Open on GitHub
                        </a>
                      </dd>
                    </div>
                  </dl>

                  {repo.lastRun ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Last run: {repo.lastRun.operation.toLowerCase().replaceAll("_", " ")} ·{" "}
                      {repo.lastRun.status.toLowerCase()}
                      {repo.lastRun.errorMessage ? ` — ${repo.lastRun.errorMessage}` : ""}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <RepoActions repository={repo} showReview />
                    <DisconnectRepository repository={repo} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Available on GitHub</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Repositories returned by your current authorization, verified against GitHub.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowAvailable((value) => !value)}>
            {showAvailable ? "Hide" : "Show"}
          </Button>
        </div>

        {showAvailable ? (
          repositories.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : filteredAvailable.length === 0 ? (
            <EmptyState
              icon={<Github className="h-6 w-6" />}
              title={available.length === 0 ? "No repositories available" : "Nothing left to connect"}
              description={
                available.length === 0
                  ? "No repositories were returned by GitHub. Reauthorize the integration if you recently granted access to a new organization."
                  : "Every accessible repository matching this filter is already connected."
              }
            />
          ) : (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Select a repository</CardTitle>
                <Badge tone="outline">{filteredAvailable.length} available</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
                  {filteredAvailable.slice(0, 100).map((repo) => (
                    <AvailableRow
                      key={repo.githubRepoId}
                      repo={repo}
                      onConnect={() => connect.mutate(repo.githubRepoId)}
                      loading={connect.isPending && connect.variables === repo.githubRepoId}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        ) : null}
      </section>
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
    <li
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
      data-testid="available-repository"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{repo.fullName}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {repo.private ? <Lock className="h-3 w-3" /> : null}
          {repo.private ? "Private" : "Public"} · default branch{" "}
          <span className="font-mono">{repo.defaultBranch}</span>
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onConnect} loading={loading}>
        <Plus className="h-3.5 w-3.5" /> Connect
      </Button>
    </li>
  );
}
