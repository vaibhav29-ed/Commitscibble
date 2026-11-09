import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  GitCommitHorizontal,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { ActivityEvent, OperationType, RunSummary } from "@commitscibble/shared";
import type { ActivityRecord } from "../lib/api";
import { cn } from "../lib/cn";
import { formatDate, relativeTime, shortSha } from "../lib/format";
import { Badge, EmptyState, StatusPill } from "./ui";

const OPERATION_LABELS: Record<OperationType, string> = {
  GENERATE: "Generate README",
  INCREMENTAL_UPDATE: "Incremental update",
  CLEANUP: "Clean up README",
  RESYNC: "Resynchronize",
  PROPOSAL_APPLY: "Apply proposal",
};

export function operationLabel(operation: OperationType): string {
  return OPERATION_LABELS[operation];
}

const EVENT_META: Record<
  ActivityEvent["type"],
  { icon: typeof CheckCircle2; className: string; label: string }
> = {
  STARTED: { icon: Clock, className: "text-[#f48d16]", label: "Started" },
  PROGRESS: { icon: Loader2, className: "text-[#f48d16]", label: "Progress" },
  SUCCESS: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400", label: "Success" },
  FAILED: { icon: XCircle, className: "text-rose-600 dark:text-rose-400", label: "Failed" },
  RETRYING: { icon: RefreshCw, className: "text-[#f48d16]", label: "Retrying" },
  CANCELLED: { icon: AlertCircle, className: "text-[var(--text-secondary)]", label: "Cancelled" },
  APPROVAL_REQUIRED: { icon: ShieldCheck, className: "text-[#f48d16]", label: "Approval required" },
  APPLIED: {
    icon: GitCommitHorizontal,
    className: "text-emerald-600 dark:text-emerald-400",
    label: "Applied",
  },
};

export function ActivityTimeline({
  events,
  showRepository = true,
  emptyTitle = "No activity yet",
  emptyDescription = "Generate documentation for a repository and progress events will appear here.",
}: {
  events: (ActivityRecord | ActivityEvent)[];
  showRepository?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="h-6 w-6" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <ol className="relative">
      {events.map((event, index) => {
        const meta = EVENT_META[event.type] ?? EVENT_META.PROGRESS;
        const Icon = meta.icon;
        const logId = "logId" in event ? event.logId : null;
        return (
          <li
            key={event.eventId}
            className="motion-event-in relative flex gap-3 py-2"
            style={{ animationDelay: `${Math.min(index, 6) * 22}ms` }}
          >
            {index < events.length - 1 ? (
              <span
                aria-hidden
                className="absolute left-[13px] top-9 h-[calc(100%-1.25rem)] w-px bg-[var(--border-soft)]"
              />
            ) : null}
            <span className="relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--border-soft)] bg-[var(--panel-solid)]">
              <Icon
                className={cn(
                  "h-3.5 w-3.5",
                  meta.className,
                  event.type === "PROGRESS" ? "framer-spinner" : "",
                )}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-[13px] font-medium leading-snug text-[var(--text-primary)]">
                  {event.message}
                </p>
                <span
                  className="text-[11px] text-[var(--text-secondary)]"
                  title={formatDate(event.createdAt)}
                >
                  {relativeTime(event.createdAt)}
                </span>
                {event.progress ? (
                  <Badge tone="outline">
                    Step {event.progress.step}/{event.progress.total}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                {showRepository && event.repositoryFullName ? (
                  <span className="font-mono">{event.repositoryFullName}</span>
                ) : null}
                <span className="font-mono uppercase tracking-[0.06em]">{event.type}</span>
                {logId ? (
                  <Link
                    to={`/dashboard/activity/${encodeURIComponent(logId)}`}
                    className="font-mono underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
                  >
                    {logId}
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function DiffViewer({ diff, className }: { diff: string; className?: string }) {
  if (!diff.trim()) {
    return (
      <div className="rounded-[12px] border border-[var(--border-soft)] bg-[var(--panel-soft)] p-6 text-center text-[12px] leading-relaxed text-[var(--text-secondary)]">
        The proposed documentation is identical to the current README.
      </div>
    );
  }

  const lines = diff.replace(/\r\n/g, "\n").split("\n");
  return (
    <div className={cn("overflow-hidden rounded-[14px] border border-[var(--border-soft)]", className)}>
      <div className="max-h-[600px] overflow-auto bg-[var(--panel-code)] dash-scroll">
        <pre className="min-w-full font-mono text-[11px] leading-5">
          {lines.map((line, index) => {
            const isAdd = line.startsWith("+") && !line.startsWith("+++");
            const isRemove = line.startsWith("-") && !line.startsWith("---");
            const isHunk = line.startsWith("@@");
            const isHeader =
              line.startsWith("diff ") || line.startsWith("---") || line.startsWith("+++");
            return (
              <div
                key={`${index}-${line.slice(0, 12)}`}
                className={cn(
                  "whitespace-pre-wrap break-all px-3",
                  isAdd && "diff-add text-emerald-700 dark:text-emerald-300",
                  isRemove && "diff-del text-rose-700 dark:text-rose-300",
                  isHunk && "bg-[var(--surface-3)] text-[var(--text-secondary)]",
                  isHeader && "text-[var(--text-secondary)]",
                )}
              >
                {line || " "}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

export function RunRow({ run, repositoryId }: { run: RunSummary; repositoryId?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-soft)] px-5 py-3.5 last:border-b-0">
      <StatusPill value={run.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">
          {operationLabel(run.operation)}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
          {relativeTime(run.createdAt)}
          {run.provider ? ` · ${run.provider}/${run.model ?? "?"}` : ""}
          {run.appliedCommitSha ? ` · ${shortSha(run.appliedCommitSha)}` : ""}
        </p>
      </div>
      {run.errorMessage ? (
        <p className="w-full truncate text-[12px] text-rose-600 dark:text-rose-400" title={run.errorMessage}>
          {run.errorMessage}
        </p>
      ) : null}
      <div className="flex items-center gap-2 text-[11px]">
        {repositoryId ? (
          <Link
            to={`/dashboard/repositories/${repositoryId}`}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Repository
          </Link>
        ) : null}
        <Link
          to={`/dashboard/reviews/${run.id}`}
          className="font-medium text-[#0000ee] hover:underline dark:text-[#8ea2ff]"
        >
          {run.proposalId ? "Review" : "Details"}
        </Link>
      </div>
    </div>
  );
}

export function RepoStatusSummary({
  documentationStatus,
  lastSuccessfulRunAt,
}: {
  documentationStatus: string;
  lastSuccessfulRunAt: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
      <StatusPill value={documentationStatus} />
      <span>
        Last successful update: {lastSuccessfulRunAt ? relativeTime(lastSuccessfulRunAt) : "never"}
      </span>
    </div>
  );
}
