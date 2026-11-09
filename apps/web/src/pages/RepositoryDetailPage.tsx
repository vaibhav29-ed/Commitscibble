import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  GitBranch,
  ListTodo,
  Loader2,
  Lock,
  Pause,
  Play,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { SECTION_KEYS, SECTION_TITLES, type SectionKey } from "@commitscibble/shared";
import {
  useCancelRun,
  useRepository,
  useRepositorySettings,
  useRepositoryTracking,
} from "../lib/query";
import { DisconnectRepository, RepoActions } from "../components/repo-actions";
import { RunRow, operationLabel } from "../components/activity";
import {
  Button,
  Input,
  Label,
  Panel,
  PanelTitle,
  Pill,
  Select,
  Skeleton,
  StatusPill,
  Switch,
  Tabs,
  Textarea,
} from "../components/ui";
import { formatDate, relativeTime, shortSha } from "../lib/format";

const WAVE_IMAGE = "/brand/landing/workflow-wave.png";

type Tab = "overview" | "runs" | "settings";

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
  const [tab, setTab] = useState<Tab>("overview");
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
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (detail.isError || !repository) {
    return (
      <Panel>
        <p className="text-[13px] leading-relaxed text-rose-600 dark:text-rose-400">
          This repository could not be loaded.{" "}
          {detail.error instanceof Error ? detail.error.message : ""}
        </p>
        <Link
          to="/dashboard/repositories"
          className="mt-3 inline-block text-[12px] font-medium text-[#0000ee] hover:underline dark:text-[#8ea2ff]"
        >
          Back to repositories
        </Link>
      </Panel>
    );
  }

  const activeRun = detail.data?.runs.find((run) =>
    ["QUEUED", "RUNNING", "RETRYING"].includes(run.status),
  );
  const runs = detail.data?.runs ?? [];

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
      <Link
        to="/dashboard/repositories"
        className="inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Repositories
      </Link>

      <section className="relative overflow-hidden rounded-[24px] border border-[var(--border-soft)] shadow-[var(--shadow-card)]">
        <img
          src={WAVE_IMAGE}
          alt=""
          className="ambient-image absolute inset-0 h-full w-full object-cover"
        />
        <div className="ambient-wash absolute inset-0" />
        <div className="relative z-10 flex flex-col justify-between gap-6 p-6 sm:p-8 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Pill icon={repository.private ? Lock : ArrowUpRight}>
                {repository.private ? "private" : "public"}
              </Pill>
              <Pill icon={GitBranch}>{repository.defaultBranch}</Pill>
              <StatusPill value={repository.trackingStatus} />
              <StatusPill value={repository.documentationStatus} />
              <Pill tone={repository.settings.updateMode === "AUTOMATIC" ? "success" : "warn"}>
                {repository.settings.updateMode === "AUTOMATIC" ? "automatic" : "review required"}
              </Pill>
            </div>
            <h1 className="dash-title break-words">{repository.fullName}</h1>
            <p className="mt-2 max-w-[620px] text-[14px] leading-relaxed text-[var(--text-secondary)]">
              {repository.description || "No description on GitHub."}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--text-secondary)]">
              <span>
                Last updated{" "}
                {repository.lastSuccessfulRunAt
                  ? relativeTime(repository.lastSuccessfulRunAt)
                  : "never"}
              </span>
              <span className="font-mono">{shortSha(repository.lastProcessedCommitSha)}</span>
              <a
                href={repository.htmlUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-medium text-[#0000ee] hover:underline dark:text-[#8ea2ff]"
              >
                Open on GitHub <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
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
                  <Play className="h-3.5 w-3.5" /> Resume
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </>
              )}
            </Button>
            <DisconnectRepository repository={repository} redirectTo="/dashboard/repositories" />
          </div>
        </div>
      </section>

      {activeRun ? (
        <div className="tone-warn flex flex-wrap items-center gap-3 rounded-[14px] px-4 py-3 text-[12px]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="flex-1">
            <span className="font-medium">{operationLabel(activeRun.operation)}</span> is{" "}
            {activeRun.status.toLowerCase()}.{" "}
            <Link to={`/dashboard/reviews/${activeRun.id}`} className="font-medium underline">
              Follow live progress
            </Link>
          </p>
          <Button
            variant="outline"
            size="sm"
            loading={cancel.isPending}
            onClick={() => cancel.mutate(activeRun.id)}
          >
            Cancel run
          </Button>
        </div>
      ) : null}

      {detail.data?.pendingProposal ? (
        <Panel className="border-[#f48d16]/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
                <ShieldCheck className="h-4 w-4 text-[#f48d16]" /> Proposal awaiting review
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                {detail.data.pendingProposal.summary} · +
                {detail.data.pendingProposal.additions} / −
                {detail.data.pendingProposal.deletions} lines · created{" "}
                {relativeTime(detail.data.pendingProposal.createdAt)}
              </p>
            </div>
            <Link to={`/dashboard/reviews/${detail.data.pendingProposal.runId}`}>
              <Button size="sm">Review diff</Button>
            </Link>
          </div>
        </Panel>
      ) : null}

      <Tabs
        active={tab}
        onChange={(value) => setTab(value as Tab)}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "runs", label: "Runs", count: runs.length },
          { id: "settings", label: "Settings" },
        ]}
      />

      <div key={tab} className="content-swap">
        {tab === "overview" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoTile
                label="Last processed commit"
                value={shortSha(repository.lastProcessedCommitSha)}
                mono
              />
              <InfoTile
                label="Documentation state"
                value={repository.documentationStatus.toLowerCase().replaceAll("_", " ")}
              />
              <InfoTile label="README path" value={repository.settings.readmePath} mono />
              <InfoTile
                label="Target branch"
                value={repository.settings.targetBranch ?? repository.defaultBranch}
                mono
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel>
                <PanelTitle
                  title="Documentation settings"
                  hint="Applies to automatic updates and manual runs"
                  icon={Settings2}
                  action={
                    <Button variant="ghost" size="sm" onClick={() => setTab("settings")}>
                      Edit
                    </Button>
                  }
                />
                <dl className="space-y-2 text-[12px]">
                  <Row label="README file" value={repository.settings.readmePath} mono />
                  <Row
                    label="Target branch"
                    value={repository.settings.targetBranch ?? repository.defaultBranch}
                    mono
                  />
                  <Row label="Update mode" value={repository.settings.updateMode} />
                  <Row
                    label="Automation"
                    value={repository.settings.automationEnabled ? "Enabled" : "Disabled"}
                  />
                  <Row
                    label="Ignored paths"
                    value={
                      repository.settings.ignoredPaths.length
                        ? repository.settings.ignoredPaths.join(", ")
                        : "None"
                    }
                    mono
                  />
                  <Row
                    label="Commit template"
                    value={repository.settings.commitMessageTemplate}
                    mono
                  />
                </dl>
                <a
                  href={repository.readmeUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-[#0000ee] hover:underline dark:text-[#8ea2ff]"
                >
                  Open README on GitHub <ExternalLink className="h-3 w-3" />
                </a>
              </Panel>

              <Panel>
                <PanelTitle title="Repository metadata" hint="Persisted connection record" />
                <dl className="space-y-2 text-[12px]">
                  <Row label="GitHub repository id" value={String(repository.githubRepoId)} mono />
                  <Row label="Connected" value={formatDate(repository.createdAt)} />
                  <Row label="Updated" value={formatDate(repository.updatedAt)} />
                  <Row
                    label="Last processed commit"
                    value={repository.lastProcessedCommitSha ?? "—"}
                    mono
                  />
                  <Row
                    label="Last successful update"
                    value={
                      repository.lastSuccessfulRunAt
                        ? formatDate(repository.lastSuccessfulRunAt)
                        : "Never"
                    }
                  />
                </dl>
              </Panel>
            </div>

            <Panel>
              <PanelTitle
                title="Recent runs"
                hint="Latest documentation operations for this repository"
                icon={ListTodo}
                action={
                  <Button variant="ghost" size="sm" onClick={() => setTab("runs")}>
                    View all
                  </Button>
                }
              />
              {runs.length === 0 ? (
                <p className="text-[12px] text-[var(--text-secondary)]">
                  No runs yet. Generate a README to create the first documentation run.
                </p>
              ) : (
                <div className="overflow-hidden rounded-[14px] border border-[var(--border-soft)]">
                  {runs.slice(0, 4).map((run) => (
                    <RunRow key={run.id} run={run} repositoryId={repository.id} />
                  ))}
                </div>
              )}
            </Panel>
          </div>
        ) : null}

        {tab === "runs" ? (
          <Panel>
            <PanelTitle
              title="Run history"
              hint={`${runs.length} recent operations`}
              icon={ListTodo}
              action={
                <Link to={`/dashboard/activity?repositoryId=${repository.id}`}>
                  <Button variant="ghost" size="sm">
                    Open activity
                  </Button>
                </Link>
              }
            />
            {runs.length === 0 ? (
              <p className="text-[12px] text-[var(--text-secondary)]">
                Generate a README, run an update, or clean up the README to create a run.
              </p>
            ) : (
              <div className="overflow-hidden rounded-[14px] border border-[var(--border-soft)]">
                {runs.map((run) => (
                  <RunRow key={run.id} run={run} repositoryId={repository.id} />
                ))}
              </div>
            )}
          </Panel>
        ) : null}

        {tab === "settings" ? (
          <Panel>
            <PanelTitle
              title="Documentation settings"
              hint="Applies to automatic updates and manual runs for this repository"
              icon={Settings2}
              action={
                <a
                  href={repository.readmeUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-[12px] text-[#0000ee] hover:underline dark:text-[#8ea2ff]"
                >
                  Open README <ExternalLink className="h-3 w-3" />
                </a>
              }
            />
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

                <div className="theme-soft flex items-start justify-between gap-4 rounded-[12px] border p-3">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">
                      Automation enabled
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
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
                  <Label
                    htmlFor="ignoredPaths"
                    hint="One glob or path prefix per line; matching files are never analysed"
                  >
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
                        className="flex items-center gap-2 rounded-[8px] border border-[var(--border-soft)] px-2.5 py-1.5 text-[12px]"
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3 accent-[#f48d16]"
                          checked={form.maintainedSections.includes(key)}
                          onChange={() => toggleSection(key)}
                        />
                        {SECTION_TITLES[key]}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-3">
                  <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
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
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function InfoTile({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
        {label}
      </p>
      <p className={`mt-1 break-all text-[13px] text-[var(--text-primary)] ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] pb-2 last:border-b-0">
      <dt className="shrink-0 text-[var(--text-secondary)]">{label}</dt>
      <dd className={`break-all text-right text-[var(--text-primary)] ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
