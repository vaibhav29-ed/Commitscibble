import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useActivityEvent } from "../lib/query";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton,
  StatusPill,
} from "../components/ui";
import { formatDate } from "../lib/format";

export default function ActivityDetailPage() {
  const { logId } = useParams<{ logId: string }>();
  const event = useActivityEvent(logId);

  return (
    <div className="space-y-5">
      <Link
        to="/dashboard/activity"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-150 ease-smooth hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to activity
      </Link>
      <PageHeader
        className="mt-2"
        eyebrow="Audit trail"
        title="Activity event"
        description="Correlated audit record. Secrets and repository content are redacted before persistence."
      />

      {event.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : event.isError || !event.data ? (
        <Card>
          <CardContent>
            <p className="text-sm leading-relaxed text-danger">
              This activity event could not be loaded. It may have expired under the retention policy.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Event</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={event.data.type === "SUCCESS" ? "SUCCEEDED" : event.data.type} />
                <Badge tone="outline">{event.data.type}</Badge>
                {event.data.progress ? (
                  <Badge tone="accent">
                    Step {event.data.progress.step}/{event.data.progress.total}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm">{event.data.message}</p>
              <dl className="grid gap-3 text-xs sm:grid-cols-2">
                <Field label="Log id" value={event.data.logId} mono />
                <Field label="Event id" value={event.data.eventId} mono />
                <Field label="Job id" value={event.data.jobId ?? "—"} mono />
                <Field label="Run id" value={event.data.runId ?? "—"} mono />
                <Field label="Repository" value={event.data.repositoryFullName ?? "—"} />
                <Field label="Recorded" value={formatDate(event.data.createdAt)} />
              </dl>

              <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-xs">
                {event.data.repositoryId ? (
                  <Link
                    to={`/dashboard/repositories/${event.data.repositoryId}`}
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    Repository settings <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : null}
                {event.data.runId ? (
                  <Link
                    to={`/dashboard/reviews/${event.data.runId}`}
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    Run detail <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Safe metadata</CardTitle>
            </CardHeader>
            <CardContent>
              {event.data.metadata && Object.keys(event.data.metadata).length > 0 ? (
                <dl className="space-y-2">
                  {Object.entries(event.data.metadata).map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between gap-3 text-xs">
                      <dt className="font-mono text-muted-foreground">{key}</dt>
                      <dd className="max-w-[60%] break-all text-right">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">No additional metadata was recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/80">
        {label}
      </dt>
      <dd className={`mt-1 break-all ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
