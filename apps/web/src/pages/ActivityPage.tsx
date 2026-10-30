import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, RefreshCw } from "lucide-react";
import { OPERATION_TYPES } from "@commitscibble/shared";
import { useActivity, useRepositories } from "../lib/query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  Skeleton,
} from "../components/ui";
import { ActivityTimeline, operationLabel } from "../components/activity";
import { useRealtimeStatus } from "../lib/realtime";

const STATUSES = ["ALL", "QUEUED", "RUNNING", "RETRYING", "SUCCEEDED", "FAILED", "CANCELLED"] as const;

export default function ActivityPage() {
  const [params, setParams] = useSearchParams();
  const repositories = useRepositories();
  const realtime = useRealtimeStatus();
  const [page, setPage] = useState(1);

  const repositoryId = params.get("repositoryId") ?? "";
  const status = params.get("status") ?? "ALL";
  const operation = params.get("operation") ?? "";

  const activity = useActivity({
    repositoryId: repositoryId || undefined,
    status: status === "ALL" ? undefined : status,
    operation: operation || undefined,
    page,
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setPage(1);
  };

  const items = activity.data?.items ?? [];
  const total = activity.data?.total ?? 0;
  const pageSize = 20;
  const hasMore = page * pageSize < total;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Authoritative audit events persisted in MongoDB, correlated by log and job id.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={realtime === "convex" ? "success" : "outline"}>
            {realtime === "convex" ? "Live subscription" : "Polling every 5s"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => activity.refetch()}
            loading={activity.isFetching}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-2xs">
            <span className="font-medium text-muted-foreground">Repository</span>
            <Select value={repositoryId} onChange={(event) => updateParam("repositoryId", event.target.value)}>
              <option value="">All repositories</option>
              {(repositories.data?.connected ?? []).map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.fullName}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-2xs">
            <span className="font-medium text-muted-foreground">Status</span>
            <Select value={status} onChange={(event) => updateParam("status", event.target.value)}>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value === "ALL" ? "All statuses" : value.charAt(0) + value.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-2xs">
            <span className="font-medium text-muted-foreground">Operation</span>
            <Select value={operation} onChange={(event) => updateParam("operation", event.target.value)}>
              <option value="">All operations</option>
              {OPERATION_TYPES.filter((value) => value !== "PROPOSAL_APPLY").map((value) => (
                <option key={value} value={value}>
                  {operationLabel(value)}
                </option>
              ))}
            </Select>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Events</CardTitle>
            <p className="text-2xs text-muted-foreground">
              {activity.isPending ? "Loading activity…" : `${total} matching event${total === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activity.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : activity.isError ? (
            <p className="text-xs text-danger">
              Activity could not be loaded. {activity.error instanceof Error ? activity.error.message : ""}
            </p>
          ) : (
            <ActivityTimeline events={items} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
