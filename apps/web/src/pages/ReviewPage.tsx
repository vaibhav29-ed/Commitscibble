import { useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Code2,
  Download,
  ExternalLink,
  GitCommitHorizontal,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useProposal, useReviewActions, useRun } from "../lib/query";
import type { ProposalDetail } from "../lib/api";
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
import { ActivityTimeline, operationLabel } from "../components/activity";
import { ReviewCockpit } from "../components/review-cockpit";
import { cn } from "../lib/cn";
import { formatDate, relativeTime, shortSha } from "../lib/format";

type ViewTab = "diff" | "proposed" | "original";

interface AppliedReceiptState {
  runId: string;
  status: "APPROVED" | "APPLIED";
  appliedCommitSha: string | null;
  reviewedAt: string | null;
  applyRunId: string | null;
}

function runViewTransition(update: () => void) {
  if (
    typeof document.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    document.startViewTransition(() => {
      flushSync(update);
    });
    return;
  }
  update();
}

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
  const [receipt, setReceipt] = useState<AppliedReceiptState | null>(null);
  const [showAppliedDiff, setShowAppliedDiff] = useState(false);

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
          <p className="text-sm leading-relaxed text-danger">
            This run could not be loaded.{" "}
            {run.error instanceof Error ? run.error.message : "Unknown error."}
          </p>
          <Link to="/dashboard/activity" className="mt-3 inline-block text-xs text-accent hover:underline">
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
  const localReceipt = receipt?.runId === summary.id ? receipt : null;
  const receiptFromDetail: AppliedReceiptState | null =
    detail && (detail.status === "APPROVED" || detail.status === "APPLIED")
      ? {
          runId: summary.id,
          status: detail.status,
          appliedCommitSha: detail.appliedCommitSha,
          reviewedAt: detail.reviewedAt,
          applyRunId: localReceipt?.applyRunId ?? null,
        }
      : null;
  const appliedReceipt =
    receiptFromDetail ?? (detail?.status === "PENDING" || !detail ? localReceipt : null);
  const openApproveDialog = () => {
    runViewTransition(() => setConfirmApprove(true));
  };
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
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Activity
          </Link>
          <h1 className="type-page-title mt-2">
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
              <Button
                size="sm"
                onClick={openApproveDialog}
                loading={actions.approve.isPending}
                style={{ viewTransitionName: confirmApprove ? "none" : "review-dialog" }}
              >
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
              <p className="text-sm font-medium">Run failed</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {summary.errorMessage ?? "The operation did not complete."}
              </p>
              {summary.errorCode ? (
                <p className="mt-1 font-mono text-xs text-danger">{summary.errorCode}</p>
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
            {appliedReceipt ? (
              <ReviewPanelFrame>
                <AppliedReceiptCard
                  detail={detail}
                  repositoryFullName={repositoryFullName}
                  receipt={appliedReceipt}
                  tab={tab}
                  onTabChange={setTab}
                  showDiff={showAppliedDiff}
                  onToggleDiff={() => setShowAppliedDiff((visible) => !visible)}
                  onDownload={downloadMarkdown}
                />
              </ReviewPanelFrame>
            ) : canReview ? (
              <ReviewPanelFrame>
                <ProposalCard
                  detail={detail}
                  tab={tab}
                  onTabChange={setTab}
                  onDownload={downloadMarkdown}
                  className="rounded-[11px] border-0 shadow-none"
                  style={{ viewTransitionName: "proposal-panel" }}
                />
              </ReviewPanelFrame>
            ) : (
              <ProposalCard
                detail={detail}
                tab={tab}
                onTabChange={setTab}
                onDownload={downloadMarkdown}
                style={{ viewTransitionName: "proposal-panel" }}
              />
            )}

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Why these changes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {detail.explanations.length > 0 ? (
                    detail.explanations.map((explanation) => (
                      <div key={`${explanation.summary}-${explanation.explanation.slice(0, 12)}`}>
                        <p className="text-sm font-medium">{explanation.summary}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{explanation.explanation}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm leading-relaxed text-muted-foreground">
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
                <CardContent className="space-y-2 text-xs">
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
                        className={`text-sm ${issue.severity === "error" ? "text-danger" : "text-warning"}`}
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
                  <p key={warning} className="text-sm leading-relaxed text-muted-foreground">
                    · {warning}
                  </p>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {detail.status === "STALE" ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
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
          <span className="text-xs text-muted-foreground">
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
        style={{ viewTransitionName: "review-dialog" }}
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
                  onSuccess: (result) => {
                    runViewTransition(() => {
                      setReceipt({
                        runId: summary.id,
                        status: "APPROVED",
                        appliedCommitSha: result.run.appliedCommitSha,
                        reviewedAt: new Date().toISOString(),
                        applyRunId: result.run.id,
                      });
                      setConfirmApprove(false);
                      setShowAppliedDiff(false);
                    });
                  },
                });
              }}
            >
              Approve &amp; apply
            </Button>
          </>
        }
      >
        <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
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

function ProposalViews({
  detail,
  tab,
  onTabChange,
}: {
  detail: ProposalDetail;
  tab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
}) {
  return (
    <>
      <Tabs
        active={tab}
        onChange={(value) => onTabChange(value as ViewTab)}
        tabs={[
          { id: "diff", label: "Unified diff" },
          { id: "proposed", label: "Proposed" },
          { id: "original", label: "Original" },
        ]}
      />
      {tab === "diff" ? (
        <ReviewCockpit
          diff={detail.diff}
          proposedContent={detail.proposedContent}
          sections={detail.sections}
        />
      ) : null}
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
    </>
  );
}

function ReviewPanelFrame({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-brand-gradient p-px shadow-card">{children}</div>;
}

function ProposalCard({
  detail,
  tab,
  onTabChange,
  onDownload,
  className,
  style,
}: {
  detail: ProposalDetail;
  tab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  onDownload: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Card style={style} className={className}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Proposed documentation</CardTitle>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{detail.summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CopyButton value={detail.proposedContent} />
          <Button variant="ghost" size="sm" onClick={onDownload}>
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ProposalViews detail={detail} tab={tab} onTabChange={onTabChange} />
      </CardContent>
    </Card>
  );
}

function AppliedReceiptCard({
  detail,
  repositoryFullName,
  receipt,
  tab,
  onTabChange,
  showDiff,
  onToggleDiff,
  onDownload,
}: {
  detail: ProposalDetail;
  repositoryFullName: string | null;
  receipt: AppliedReceiptState;
  tab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  showDiff: boolean;
  onToggleDiff: () => void;
  onDownload: () => void;
}) {
  const applied = receipt.status === "APPLIED";
  const sha = receipt.appliedCommitSha;

  return (
    <Card
      style={{ viewTransitionName: "proposal-panel" }}
      className="overflow-hidden rounded-[11px] border-0 shadow-none"
    >
      <CardHeader className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <CardTitle className="font-display text-2xl font-medium leading-tight tracking-[-0.025em]">
                {applied ? "Documentation applied" : "Documentation approved"}
              </CardTitle>
              <StatusPill value={receipt.status} />
            </div>
            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
              {applied
                ? "The reviewed changes are now committed to the configured branch."
                : "The apply run is queued. This receipt updates when GitHub confirms the commit."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <CopyButton value={detail.proposedContent} />
            <Button variant="ghost" size="sm" onClick={onDownload}>
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div className="min-w-0">
            <p className="text-2xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {applied ? "Applied commit" : "Commit pending"}
            </p>
            {sha ? (
              <p
                title={sha}
                className="mt-1.5 truncate font-mono text-[1.75rem] leading-none tracking-[-0.03em] tabular-nums sm:text-[2rem]"
              >
                {shortSha(sha)}
              </p>
            ) : (
              <p className="mt-1.5 font-mono text-xl leading-none text-muted-foreground">
                Awaiting commit
              </p>
            )}
          </div>
          {sha && repositoryFullName ? (
            <a
              href={`https://github.com/${repositoryFullName}/commit/${sha}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="h-3.5 w-3.5" /> View commit
              </Button>
            </a>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <LedgerFact
            label="Base commit"
            value={detail.baseCommitSha ? shortSha(detail.baseCommitSha) : "—"}
            mono
          />
          <LedgerFact
            label="Reviewed"
            value={receipt.reviewedAt ? formatDate(receipt.reviewedAt) : "Just now"}
          />
          <LedgerFact label="Repository" value={repositoryFullName ?? "—"} mono />
        </dl>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          {receipt.applyRunId ? (
            <Link
              to={`/dashboard/reviews/${receipt.applyRunId}`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" /> Apply run {receipt.applyRunId.slice(0, 7)}
            </Link>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={onToggleDiff}
            aria-expanded={showDiff}
          >
            <Code2 className="h-3.5 w-3.5" /> {showDiff ? "Hide diff" : "Inspect diff"}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none",
                showDiff && "rotate-180",
              )}
            />
          </Button>
        </div>
        {showDiff ? (
          <div className="space-y-3 border-t border-border pt-3">
            <ProposalViews detail={detail} tab={tab} onTabChange={onTabChange} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LedgerFact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 truncate text-[13px] leading-tight", mono && "font-mono text-xs")}>
        {value}
      </dd>
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
