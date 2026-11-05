import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Eraser, FileText, GitPullRequestArrow, RefreshCw } from "lucide-react";
import { Button, Dialog, Label, Switch } from "./ui";
import {
  useDisconnectRepository,
  useRepositoryActions,
} from "../lib/query";
import type { ConnectedRepositoryView } from "../lib/api";
import { useNavigate } from "react-router-dom";

const ACTION_COPY = {
  generate: {
    label: "Generate README",
    title: "Generate a full README?",
    description:
      "CommitScibble will inspect the repository and create a complete README proposal. In review mode nothing is written until you approve it.",
    confirm: "Queue generation",
    icon: FileText,
  },
  update: {
    label: "Run update",
    title: "Run an incremental update?",
    description:
      "The latest commit is compared with the last processed commit. Only README sections affected by the change are proposed.",
    confirm: "Queue update",
    icon: RefreshCw,
  },
  cleanup: {
    label: "Clean up",
    title: "Clean up this README?",
    description:
      "The cleanup pass restructures the README and removes duplication while verifying that documented commands, variables, and license text survive. It is applied according to the repository update mode.",
    confirm: "Queue cleanup",
    icon: Eraser,
  },
} as const;

export function RepoActions({
  repository,
  showReview = true,
  align = "start",
}: {
  repository: ConnectedRepositoryView;
  showReview?: boolean;
  align?: "start" | "end";
}) {
  const [pending, setPending] = useState<keyof typeof ACTION_COPY | null>(null);
  const actions = useRepositoryActions(repository.id);
  const disabled = repository.trackingStatus === "DISCONNECTED";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${align === "end" ? "justify-end" : ""}`}>
      {showReview && repository.pendingProposalRunId ? (
        <Link to={`/dashboard/reviews/${repository.pendingProposalRunId}`}>
          <Button size="sm">
            <GitPullRequestArrow className="h-3.5 w-3.5" /> Review
          </Button>
        </Link>
      ) : null}
      {(Object.keys(ACTION_COPY) as (keyof typeof ACTION_COPY)[]).map((key) => {
        const copy = ACTION_COPY[key];
        return (
          <Button
            key={key}
            size="sm"
            variant={key === "generate" && !repository.pendingProposalRunId ? "outline" : "secondary"}
            disabled={disabled}
            onClick={() => setPending(key)}
          >
            <copy.icon className="h-3.5 w-3.5" /> {copy.label}
          </Button>
        );
      })}

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? ACTION_COPY[pending].title : ""}
        description={pending ? ACTION_COPY[pending].description : ""}
        footer={
          <>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              loading={actions.start.isPending}
              onClick={() => {
                if (!pending) return;
                actions.start.mutate(pending, {
                  onSettled: () => setPending(null),
                });
              }}
            >
              {pending ? ACTION_COPY[pending].confirm : "Continue"}
            </Button>
          </>
        }
      >
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm leading-relaxed">
          <p className="font-medium">{repository.fullName}</p>
          <p className="mt-1 text-muted-foreground">
            Update mode: <span className="text-foreground">{repository.settings.updateMode}</span>
            {repository.settings.updateMode === "AUTOMATIC"
              ? " — changes are committed to the repository without a review step."
              : " — a proposal is stored for your approval."}
          </p>
          <p className="mt-1 text-muted-foreground">
            Target: {repository.settings.targetBranch ?? repository.defaultBranch} ·{" "}
            {repository.settings.readmePath}
          </p>
        </div>
      </Dialog>
    </div>
  );
}

export function DisconnectRepository({
  repository,
  redirectTo,
}: {
  repository: ConnectedRepositoryView;
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [revoke, setRevoke] = useState(false);
  const disconnect = useDisconnectRepository(repository.id);
  const navigate = useNavigate();

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Disconnect
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Disconnect ${repository.fullName}?`}
        description="Webhook deliveries for this repository will be ignored and its documentation settings removed from automation."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={disconnect.isPending}
              onClick={() =>
                disconnect.mutate(revoke, {
                  onSuccess: () => {
                    setOpen(false);
                    if (redirectTo) navigate(redirectTo);
                  },
                })
              }
            >
              Disconnect repository
            </Button>
          </>
        }
      >
        <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
          <div>
            <Label htmlFor="revoke">Revoke GitHub authorization</Label>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Also deletes the encrypted token, ends all sessions, and disconnects every repository
              owned by this account. You will need to sign in with GitHub again to reconnect.
            </p>
          </div>
          <Switch
            checked={revoke}
            onChange={setRevoke}
            label="Revoke GitHub authorization"
          />
        </div>
        {revoke ? (
          <p className="mt-3 text-sm leading-relaxed text-warning">
            This affects every repository in this account, not just {repository.fullName}.
          </p>
        ) : null}
      </Dialog>
    </>
  );
}

export function SeeDetails({ repositoryId }: { repositoryId: string }) {
  return (
    <Link
      to={`/dashboard/repositories/${repositoryId}`}
      className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
    >
      Repository settings <ArrowRight className="h-3 w-3" />
    </Link>
  );
}
