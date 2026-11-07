import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Github, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useLogout, useMe, useMeta } from "../lib/query";
import { useToast } from "../lib/toast";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  PageHeader,
  Skeleton,
} from "../components/ui";
import { formatDate } from "../lib/format";

export default function SettingsPage() {
  const me = useMe();
  const meta = useMeta();
  const logout = useLogout();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [revokeOpen, setRevokeOpen] = useState(false);

  const revoke = useMutation({
    mutationFn: api.revokeGithubAuthorization,
    onSuccess: (result) => {
      queryClient.clear();
      setRevokeOpen(false);
      toast.push({
        title: result.revoked ? "GitHub authorization revoked" : "Stored authorization removed",
        description: "Sessions ended and all repositories were disconnected.",
        variant: "success",
      });
      navigate("/signin");
    },
    onError: (error) => {
      toast.push({
        title: "Could not revoke authorization",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    },
  });

  const user = me.data?.user;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Account, integration, and deployment configuration that affects documentation behaviour."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" /> GitHub account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {me.isPending ? (
              <Skeleton className="h-20 w-full" />
            ) : user ? (
              <>
                <div className="flex items-center gap-3">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="h-10 w-10 rounded-full border border-border"
                    />
                  ) : (
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-xs">
                      {user.githubLogin.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-medium">{user.displayName ?? user.githubLogin}</p>
                    <p className="text-xs text-muted-foreground">
                      @{user.githubLogin} · GitHub id {user.githubId}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <Info label="Email" value={user.email ?? "Not provided by GitHub"} />
                  <Info label="Account created" value={formatDate(user.createdAt)} />
                  <Info label="Session" value="HttpOnly cookie · 7 day expiry" />
                  <Info label="CSRF" value="Double-submit token on mutations" />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logout.mutate(undefined, { onSettled: () => navigate("/signin") })}
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setRevokeOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Revoke GitHub authorization
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-danger">Your session is no longer valid.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" /> Deployment configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {meta.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : meta.data ? (
              <>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <Info label="Default README file" value={meta.data.readmeFileName} />
                  <Info label="Default update mode" value={meta.data.defaultUpdateMode} />
                  <Info label="Audit retention" value={`${meta.data.retention.auditDays} days`} />
                  <Info label="Webhook retention" value={`${meta.data.retention.webhookDays} days`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">AI providers configured</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {meta.data.aiProviders.length > 0 ? (
                      meta.data.aiProviders.map((provider) => (
                        <Badge key={provider} tone="accent">
                          {provider}
                        </Badge>
                      ))
                    ) : (
                      <Badge tone="danger">None — documentation runs will fail</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Provider and model identifiers are deployment environment settings
                    (GEMINI_MODEL, GROQ_MODEL). They are not editable per user in this build.
                  </p>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">GitHub App</p>
                  {meta.data.githubApp.configured && meta.data.githubApp.installUrl ? (
                    <a
                      href={meta.data.githubApp.installUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-1 inline-block text-xs font-medium text-accent hover:underline"
                    >
                      Install or manage the GitHub App
                    </a>
                  ) : (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Not configured — repository writes use the OAuth token.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
                  <Badge tone={meta.data.realtime.convex ? "success" : "outline"}>
                    {meta.data.realtime.convex ? "Convex realtime configured" : "Polling activity (Convex not configured)"}
                  </Badge>
                  <Badge tone={meta.data.billingEnabled ? "warning" : "outline"}>
                    {meta.data.billingEnabled ? "Billing enabled" : "Billing disabled"}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Deployment metadata is unavailable. The API may be misconfigured.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per-repository documentation settings</CardTitle>
        </CardHeader>
        <CardContent className="max-w-xl space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            README path, target branch, update mode, automation, ignore rules, maintained sections,
            and the commit message template are configured per repository.
          </p>
          <Link to="/dashboard/repositories" className="inline-block text-xs font-medium text-accent hover:underline">
            Open repositories
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Data deletion
          </CardTitle>
        </CardHeader>
        <CardContent className="max-w-xl space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            Revoking the GitHub authorization removes the encrypted access token, ends every
            session, disconnects all repositories, and stops webhook processing immediately.
          </p>
          <p>
            Audit events and webhook delivery records are retained for the configured retention
            window and then deleted by database TTL indexes. Repository source code is never stored
            by CommitScibble.
          </p>
        </CardContent>
      </Card>

      <Dialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        title="Revoke GitHub authorization?"
        description="This ends your sessions and disconnects every repository. To use CommitScibble again you must sign in with GitHub and reconnect repositories."
        footer={
          <>
            <Button variant="outline" onClick={() => setRevokeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={revoke.isPending}
              onClick={() => revoke.mutate()}
            >
              Revoke and sign out
            </Button>
          </>
        }
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/80">
        {label}
      </p>
      <p className="mt-1 break-all">{value}</p>
    </div>
  );
}
