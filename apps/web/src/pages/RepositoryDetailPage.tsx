import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, GitBranch, Loader2, Lock, Pause, Play, ShieldCheck } from "lucide-react";
import { SECTION_KEYS, SECTION_TITLES, type SectionKey } from "@commitscibble/shared";
import {
  useCancelRun,
  useRepository,
  useRepositorySettings,
  useRepositoryTracking,
} from "../lib/query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  Skeleton,
  StatusPill,
  Switch,
  Textarea,
} from "../components/ui";
import { DisconnectRepository, RepoActions } from "../components/repo-actions";
import { RunRow, operationLabel } from "../components/activity";
import { formatDate, relativeTime, shortSha } from "../lib/format";

interface SettingsForm {
  readmePath: string;
  targetBranch: string;
  updateMode: "AUTOMATIC" | "REVIEW";
  automationEnabled: boolean;
  ignoredPathsText: string;
  maintainedSections: SectionKey[];
  commitMessageTemplate: string;
}

export default function RepositoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useRepository(id);
  const save = useRepositorySettings(id ?? "");
  const tracking = useRepositoryTracking(id ?? "");
  const cancel = useCancelRun();
  const [form, setForm] = useState<SettingsForm | null>(null);

  const repository = detail.data?.repository;

  useEffect(() => {
    if (!repository) return;
    setForm({
      readmePath: repository.settings.readmePath,
      targetBranch: repository.settings.targetBranch ?? "",
      updateMode: repository.settings.updateMode,
      automationEnabled: repository.settings.automationEnabled,
      ignoredPathsText: repository.settings.ignoredPaths.join("\n"),
      maintainedSections: repository.settings.maintainedSections,
      commitMessageTemplate: repository.settings.commitMessageTemplate,
    });
  }, [repository]);

  if (detail.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (detail.isError || !repository) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm leading-relaxed text-danger">
            This repository could not be loaded.{" "}
            {detail.error instanceof Error ? detail.error.message : ""}
          </p>
          <Link to="/dashboard/repositories" className="mt-3 inline-block text-xs text-accent hover:underline">
            Back to repositories
          </Link>
        </CardContent>
      </Card>
    );
  }

  const activeRun = detail.data?.runs.find((run) =>
    ["QUEUED", "RUNNING", "RETRYING"].includes(run.status),
  );

  const toggleSection = (key: SectionKey) => {
    setForm((current) => {
      if (!current) return current;
      const has = current.maintainedSections.includes(key);
      return {
        ...current,
        maintainedSections: has
          ? current.maintainedSections.filter((entry) => entry !== key)
          : [...current.maintainedSections, key],
      };
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/dashboard/repositories"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Repositories
          </Link>
          <h1 className="type-page-title mt-2 truncate">{repository.fullName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge tone="outline">
              <GitBranch className="h-3 w-3" /> {repository.defaultBranch}
            </Badge>
            <Badge tone="outline">
              {repository.private ? <Lock className="h-3 w-3" /> : null}
              {repository.private ? "Private" : "Public"}
            </Badge>
            <StatusPill value={repository.trackingStatus} />
            <StatusPill value={repository.documentationStatus} />
            <StatusPill value={repository.settings.updateMode} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RepoActions repository={repository} showReview />
          <Button
            variant="outline"
            size="sm"
            loading={tracking.isPending}
            onClick={() =>
              tracking.mutate(repository.trackingStatus === "PAUSED" ? "CONNECTED" : "PAUSED")
            }
          >
            {repository.trackingStatus === "PAUSED" ? (
              <>
                <Play className="h-3.5 w-3.5" /> Resume tracking
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" /> Pause tracking
              </>
            )}
          </Button>
          <DisconnectRepository repository={repository} redirectTo="/dashboard/repositories" />
        </div>
      </div>

      {activeRun ? (
        <div className="flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <p>
            <span className="font-medium">{operationLabel(activeRun.operation)}</span> is{" "}
            {activeRun.status.toLowerCase()}.{" "}
            <Link to={`/dashboard/reviews/${activeRun.id}`} className="text-accent hover:underline">
              Follow live progress
            </Link>
            .
          </p>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            loading={cancel.isPending}
            onClick={() => cancel.mutate(activeRun.id)}
          >
            Cancel run
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile label="Last processed commit" value={shortSha(repository.lastProcessedCommitSha)} mono />
        <InfoTile
          label="Last successful update"
          value={repository.lastSuccessfulRunAt ? relativeTime(repository.lastSuccessfulRunAt) : "Never"}
        />
        <InfoTile label="README path" value={repository.settings.readmePath} mono />
        <InfoTile
          label="Target branch"
          value={repository.settings.targetBranch ?? repository.defaultBranch}
          mono
        />
      </div>

      {detail.data?.pendingProposal ? (
        <Card className="border-warning/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-warning" /> Proposal awaiting review
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {detail.data.pendingProposal.summary} · +{detail.data.pendingProposal.additions} / −
                {detail.data.pendingProposal.deletions} lines · created{" "}
                {relativeTime(detail.data.pendingProposal.createdAt)}
              </p>
            </div>
            <Link to={`/dashboard/reviews/${detail.data.pendingProposal.runId}`}>
              <Button size="sm">Review diff</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Documentation settings</CardTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Applies to automatic updates and manual runs for this repository.
              </p>
            </div>
            <a
              href={repository.readmeUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Open README <ExternalLink className="h-3 w-3" />
            </a>
          </CardHeader>
          <CardContent>
            {form ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  save.mutate({
                    readmePath: form.readmePath.trim(),
                    targetBranch: form.targetBranch.trim() ? form.targetBranch.trim() : null,
                    updateMode: form.updateMode,
                    automationEnabled: form.automationEnabled,
                    ignoredPaths: form.ignoredPathsText
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                    maintainedSections: form.maintainedSections,
                    commitMessageTemplate: form.commitMessageTemplate.trim(),
                  });
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="readmePath" hint="Relative path, for example README.md or docs/README.md">
                      README file
                    </Label>
                    <Input
                      id="readmePath"
                      value={form.readmePath}
                      onChange={(event) => setForm({ ...form, readmePath: event.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="targetBranch" hint="Leave empty to use the default branch">
                      Target branch
                    </Label>
                    <Input
                      id="targetBranch"
                      value={form.targetBranch}
                      placeholder={repository.defaultBranch}
                      onChange={(event) => setForm({ ...form, targetBranch: event.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="updateMode" hint="Automatic commits without review when enabled">
                      Update mode
                    </Label>
                    <Select
                      id="updateMode"
                      value={form.updateMode}
                      onChange={(event) =>
                        setForm({ ...form, updateMode: event.target.value as "AUTOMATIC" | "REVIEW" })
                      }
                    >
                      <option value="REVIEW">Review required</option>
                      <option value="AUTOMATIC">Automatic</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="commitMessage" hint="Use {readmePath} as a placeholder">
                      Commit message template
                    </Label>
                    <Input
                      id="commitMessage"
                      value={form.commitMessageTemplate}
                      onChange={(event) =>
                        setForm({ ...form, commitMessageTemplate: event.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Automation enabled</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      When off, webhook-triggered runs are skipped. Manual actions still work.
                    </p>
                  </div>
                  <Switch
                    checked={form.automationEnabled}
                    onChange={(value) => setForm({ ...form, automationEnabled: value })}
                    label="Automation enabled"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ignoredPaths" hint="One glob or path prefix per line; matching files are never analysed">
                    Ignored paths
                  </Label>
                  <Textarea
                    id="ignoredPaths"
                    rows={3}
                    value={form.ignoredPathsText}
                    onChange={(event) => setForm({ ...form, ignoredPathsText: event.target.value })}
                    placeholder={"examples/\n*.generated.ts"}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label hint="With no selection, every verifiable section is maintained">
                    Maintained sections
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {SECTION_KEYS.map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs"
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3 accent-[rgb(var(--accent))]"
                          checked={form.maintainedSections.includes(key)}
                          onChange={() => toggleSection(key)}
                        />
                        {SECTION_TITLES[key]}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Changes to the branch are validated against GitHub.
                  </p>
                  <Button type="submit" size="sm" loading={save.isPending}>
                    Save settings
                  </Button>
                </div>
              </form>
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent runs</CardTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">Latest ten documentation operations</p>
            </div>
            <Link to={`/dashboard/activity?repositoryId=${repository.id}`} className="text-xs text-accent hover:underline">
              All activity
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {detail.data && detail.data.runs.length > 0 ? (
              detail.data.runs.map((run) => (
                <RunRow key={run.id} run={run} repositoryId={repository.id} />
              ))
            ) : (
              <div className="p-4">
                <EmptyState
                  icon={<GitBranch className="h-6 w-6" />}
                  title="No runs yet"
                  description="Generate a README to create the first documentation run."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Repository metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <InfoTile label="GitHub repository id" value={String(repository.githubRepoId)} mono />
          <InfoTile label="Connected" value={formatDate(repository.createdAt)} />
          <InfoTile label="Last processed commit" value={repository.lastProcessedCommitSha ?? "—"} mono />
          <InfoTile label="Commit template" value={repository.settings.commitMessageTemplate} mono />
        </CardContent>
      </Card>
    </div>
  );
}

function InfoTile({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 break-all text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
