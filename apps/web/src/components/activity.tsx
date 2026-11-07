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
  STARTED: { icon: Clock, className: "text-accent", label: "Started" },
  PROGRESS: { icon: Loader2, className: "text-accent", label: "Progress" },
  SUCCESS: { icon: CheckCircle2, className: "text-success", label: "Success" },
  FAILED: { icon: XCircle, className: "text-danger", label: "Failed" },
  RETRYING: { icon: RefreshCw, className: "text-warning", label: "Retrying" },
  CANCELLED: { icon: AlertCircle, className: "text-muted-foreground", label: "Cancelled" },
  APPROVAL_REQUIRED: { icon: ShieldCheck, className: "text-warning", label: "Approval required" },
  APPLIED: { icon: GitCommitHorizontal, className: "text-success", label: "Applied" },
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
    <ol className="relative space-y-1">
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
                className="absolute left-[11px] top-8 h-[calc(100%-1rem)] w-px bg-border"
              />
            ) : null}
            <span className="relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-card">
              <Icon
                className={cn(
                  "h-3.5 w-3.5",
                  meta.className,
                  event.type === "PROGRESS" ? "animate-[spin_4s_linear_infinite]" : "",
                )}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-sm font-medium">{event.message}</p>
                <span className="text-xs text-muted-foreground" title={formatDate(event.createdAt)}>
                  {relativeTime(event.createdAt)}
                </span>
                {event.progress ? (
                  <Badge tone="outline">
                    Step {event.progress.step}/{event.progress.total}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {showRepository && event.repositoryFullName ? (
                  <span className="font-mono">{event.repositoryFullName}</span>
                ) : null}
                <span className="font-mono">{event.type.toLowerCase()}</span>
                {logId ? (
                  <Link
                    to={`/dashboard/activity/${encodeURIComponent(logId)}`}
                    className="font-mono underline-offset-2 hover:text-foreground hover:underline"
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
      <div className="rounded-xl border border-border bg-muted p-6 text-center text-sm leading-relaxed text-muted-foreground">
        The proposed documentation is identical to the current README.
      </div>
    );
  }

  const lines = diff.replace(/\r\n/g, "\n").split("\n");
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border", className)}>
      <div className="max-h-[600px] overflow-auto bg-code-bg">
        <pre className="min-w-full font-mono text-xs leading-5">
          {lines.map((line, index) => {
            const isAdd = line.startsWith("+") && !line.startsWith("+++");
            const isRemove = line.startsWith("-") && !line.startsWith("---");
            const isHunk = line.startsWith("@@");
            const isHeader = line.startsWith("diff ") || line.startsWith("---") || line.startsWith("+++");
            return (
              <div
                key={`${index}-${line.slice(0, 12)}`}
                className={cn(
                  "whitespace-pre-wrap break-all px-3",
                  isAdd && "bg-success/10 text-success",
                  isRemove && "bg-danger/10 text-danger",
                  isHunk && "bg-muted/60 text-muted-foreground",
                  isHeader && "text-muted-foreground",
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
  const reviewLink = `/dashboard/reviews/${run.id}`;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5 last:border-b-0">
      <StatusPill value={run.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{operationLabel(run.operation)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {relativeTime(run.createdAt)}
          {run.provider ? ` · ${run.provider}/${run.model ?? "?"}` : ""}
          {run.appliedCommitSha ? ` · ${shortSha(run.appliedCommitSha)}` : ""}
        </p>
      </div>
      {run.errorMessage ? (
        <p className="w-full truncate text-sm text-danger" title={run.errorMessage}>
          {run.errorMessage}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        {repositoryId ? (
          <Link
            to={`/dashboard/repositories/${repositoryId}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Repository
          </Link>
        ) : null}
        <Link
          to={reviewLink}
          className="text-xs font-medium text-accent hover:underline"
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
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <StatusPill value={documentationStatus} />
      <span>Last successful update: {lastSuccessfulRunAt ? relativeTime(lastSuccessfulRunAt) : "never"}</span>
    </div>
  );
}
