import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  GitCommitHorizontal,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useProposal, useReviewActions, useRun } from "../lib/query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CopyButton,
  Dialog,
  EmptyState,
  Skeleton,
  StatusPill,
  Tabs,
} from "../components/ui";
import { ActivityTimeline, DiffViewer, operationLabel } from "../components/activity";
import { formatDate, relativeTime, shortSha } from "../lib/format";

type ViewTab = "diff" | "proposed" | "original";

export default function ReviewPage() {
  const { runId } = useParams<{ runId: string }>();
  const run = useRun(runId);
  const hasProposal = Boolean(run.data?.run.proposalId);
  const proposal = useProposal(runId, hasProposal);
  const actions = useReviewActions();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ViewTab>("diff");
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  if (run.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (run.isError || !run.data) {
    return (
      <Card>
        <CardContent>
          <p className="text-xs text-danger">
            This run could not be loaded.{" "}
            {run.error instanceof Error ? run.error.message : "Unknown error."}
          </p>
          <Link to="/dashboard/activity" className="mt-3 inline-block text-2xs text-accent hover:underline">
            Back to activity
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { run: summary, repositoryFullName, events, warnings, analysisUnsupported } = run.data;
  const detail = proposal.data?.proposal;
  const isActive = ["QUEUED", "RUNNING", "RETRYING"].includes(summary.status);
  const canReview = detail?.status === "PENDING";
  const downloadMarkdown = () => {
    if (!detail) return;
    const blob = new Blob([detail.proposedContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = detail.sections.length ? "README.proposed.md" : "README.cleaned.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/dashboard/activity"
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Activity
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            {operationLabel(summary.operation)}
            {repositoryFullName ? (
              <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                {repositoryFullName}
              </span>
            ) : null}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill value={summary.status} />
            {detail ? <StatusPill value={detail.status} /> : null}
            <Badge tone="outline">Run {summary.id.slice(-6)}</Badge>
            <Badge tone="outline">Log {summary.correlationId.slice(-8)}</Badge>
            {summary.provider ? (
              <Badge tone="accent">
                {summary.provider}/{summary.model ?? "model"}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canReview ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setConfirmReject(true)}>
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
              <Button size="sm" onClick={() => setConfirmApprove(true)} loading={actions.approve.isPending}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve &amp; apply
              </Button>
            </>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            loading={actions.retry.isPending}
            onClick={() =>
              actions.retry.mutate(summary.id, {
                onSuccess: (result) => navigate(`/dashboard/reviews/${result.run.id}`),
              })
            }
          >
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
          </Button>
        </div>
      </div>

      {summary.status === "FAILED" ? (
        <Card className="border-danger/40">
          <CardContent className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div>
              <p className="text-xs font-medium">Run failed</p>
              <p className="mt-1 text-2xs text-muted-foreground">
                {summary.errorMessage ?? "The operation did not complete."}
              </p>
              {summary.errorCode ? (
                <p className="mt-1 font-mono text-2xs text-danger">{summary.errorCode}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isActive && !detail ? (
        <Card>
          <CardHeader>
            <CardTitle>Working…</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline events={events} showRepository={false} />
          </CardContent>
        </Card>
      ) : null}

      {detail ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>Proposed documentation</CardTitle>
                  <p className="mt-1 text-2xs text-muted-foreground">{detail.summary}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <CopyButton value={detail.proposedContent} />
                  <Button variant="ghost" size="sm" onClick={downloadMarkdown}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Tabs
                  active={tab}
                  onChange={(value) => setTab(value as ViewTab)}
                  tabs={[
                    { id: "diff", label: "Unified diff" },
                    { id: "proposed", label: "Proposed" },
                    { id: "original", label: "Original" },
                  ]}
                />
                {tab === "diff" ? <DiffViewer diff={detail.diff} /> : null}
                {tab === "proposed" ? (
                  <pre className="max-h-[600px] overflow-auto rounded-md border border-border bg-code-bg p-3 font-mono text-xs leading-5">
                    {detail.proposedContent}
                  </pre>
                ) : null}
                {tab === "original" ? (
                  detail.originalContent ? (
                    <pre className="max-h-[600px] overflow-auto rounded-md border border-border bg-code-bg p-3 font-mono text-xs leading-5">
                      {detail.originalContent}
                    </pre>
                  ) : (
                    <EmptyState
                      title="No existing README"
                      description="This proposal creates the documentation file from scratch."
                    />
                  )
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Why these changes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {detail.explanations.length > 0 ? (
                    detail.explanations.map((explanation) => (
                      <div key={`${explanation.summary}-${explanation.explanation.slice(0, 12)}`}>
                        <p className="text-2xs font-medium">{explanation.summary}</p>
                        <p className="mt-0.5 text-2xs text-muted-foreground">{explanation.explanation}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-2xs text-muted-foreground">
                      The provider did not return a per-section explanation for this run.
                    </p>
                  )}
                  {detail.sections.length > 0 ? (
                    <div className="flex flex-wrap gap-1 border-t border-border pt-2">
                      {detail.sections.map((section) => (
                        <Badge key={section} tone="outline">
                          {section}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Review context</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-2xs">
                  <Row label="Base commit" value={detail.baseCommitSha ? shortSha(detail.baseCommitSha) : "—"} mono />
                  <Row label="Base README hash" value={`${detail.baseReadmeHash.slice(0, 12)}…`} mono />
                  <Row label="Diff size" value={`+${detail.additions} / −${detail.deletions}`} />
                  <Row label="Created" value={formatDate(detail.createdAt)} />
                  {detail.reviewedAt ? <Row label="Reviewed" value={formatDate(detail.reviewedAt)} /> : null}
                  {detail.appliedCommitSha ? (
                    <Row label="Applied commit" value={shortSha(detail.appliedCommitSha)} mono />
                  ) : null}
                  {detail.appliedCommitSha ? (
                    <p className="flex items-center gap-1 pt-1 text-accent">
                      <GitCommitHorizontal className="h-3 w-3" /> Documentation commit recorded
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {detail.validationIssues.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Validation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {detail.validationIssues.slice(0, 12).map((issue, index) => (
                      <p
                        key={`${issue.message}-${index}`}
                        className={`text-2xs ${issue.severity === "error" ? "text-danger" : "text-warning"}`}
                      >
                        {issue.severity === "error" ? "Error" : "Warning"}: {issue.message}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>

          {warnings.length > 0 || analysisUnsupported.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-warning" /> Warnings and uncertainties
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {[...new Set([...warnings, ...analysisUnsupported])].slice(0, 20).map((warning) => (
                  <p key={warning} className="text-2xs text-muted-foreground">
                    · {warning}
                  </p>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {detail.status === "APPLIED" ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-xs text-success">
              <CheckCircle2 className="h-4 w-4" />
              <span>Approved documentation has been applied to GitHub.</span>
              {detail.appliedCommitSha ? (
                <span className="font-mono text-2xs">{detail.appliedCommitSha}</span>
              ) : null}
            </div>
          ) : null}
          {detail.status === "STALE" ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span>
                This proposal is stale because the README changed after it was generated. Regenerate
                to review the current content.
              </span>
            </div>
          ) : null}
        </>
      ) : !isActive && summary.status === "SUCCEEDED" ? (
        <Card>
          <CardContent className="space-y-3">
            <EmptyState
              icon={<CheckCircle2 className="h-6 w-6 text-success" />}
              title="No proposal was needed"
              description="The run completed without documentation changes, so there is nothing to review."
            />
            <div className="flex justify-center">
              <Link to={`/dashboard/repositories/${summary.repositoryId}`}>
                <Button variant="outline" size="sm">
                  Open repository <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Run events</CardTitle>
          <span className="text-2xs text-muted-foreground">
            Updated {relativeTime(summary.updatedAt)}
          </span>
        </CardHeader>
        <CardContent>
          <ActivityTimeline events={events} showRepository={false} />
        </CardContent>
      </Card>

      <Dialog
        open={confirmApprove}
        onClose={() => setConfirmApprove(false)}
        title="Approve and apply this proposal?"
        description="The proposed file will be committed to the configured branch in GitHub."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmApprove(false)}>
              Cancel
            </Button>
            <Button
              loading={actions.approve.isPending}
              onClick={() => {
                if (!detail) return;
                actions.approve.mutate(detail.id, {
                  onSuccess: () => setConfirmApprove(false),
                });
              }}
            >
              Approve &amp; apply
            </Button>
          </>
        }
      >
        <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-2xs text-muted-foreground">
          <p>
            Target commit:{" "}
            <span className="font-mono text-foreground">{shortSha(detail?.baseCommitSha)}</span>
          </p>
          <p>
            The worker re-fetches the README first. If it changed since this proposal was generated,
            the proposal is marked stale and nothing is written.
          </p>
        </div>
      </Dialog>

      <Dialog
        open={confirmReject}
        onClose={() => setConfirmReject(false)}
        title="Reject this proposal?"
        description="The README will not be modified. You can generate a new proposal later."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmReject(false)}>
              Keep proposal
            </Button>
            <Button
              variant="danger"
              loading={actions.reject.isPending}
              onClick={() => {
                if (!detail) return;
                actions.reject.mutate(detail.id, {
                  onSuccess: () => setConfirmReject(false),
                });
              }}
            >
              Reject
            </Button>
          </>
        }
      />
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`break-all text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
