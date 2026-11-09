import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RepoSettings, RunSummary } from "@commitscibble/shared";
import { api, ApiError, type ConnectedRepositoryView } from "./api";
import { useToast } from "./toast";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false,
    staleTime: 30_000,
  });
}

export function useMeta() {
  return useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: 5 * 60_000, retry: false });
}

export function useRepositories(enabled = true) {
  return useQuery({
    queryKey: ["repositories"],
    queryFn: api.listRepositories,
    enabled,
    refetchInterval: 20_000,
  });
}

export function useRepository(id: string | undefined) {
  return useQuery({
    queryKey: ["repository", id],
    queryFn: () => api.getRepository(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      const active = data?.runs.some((run) => ["QUEUED", "RUNNING", "RETRYING"].includes(run.status));
      return active ? 4000 : 20_000;
    },
  });
}

export interface RepositoryRunsResult {
  repository: ConnectedRepositoryView;
  runs: RunSummary[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Runs are only exposed per repository by the API, so the jobs screen fans out
 * across the connected repositories the workspace already knows about.
 */
export function useRepositoryRuns(repositories: ConnectedRepositoryView[]) {
  const results = useQueries({
    queries: repositories.map((repository) => ({
      queryKey: ["repository-runs", repository.id],
      queryFn: () => api.listRuns(repository.id, 1, 20),
      refetchInterval: 10_000,
    })),
  });

  return repositories.map((repository, index) => {
    const result = results[index];
    return {
      repository,
      runs: result?.data?.items ?? [],
      isLoading: result?.isPending ?? true,
      isError: result?.isError ?? false,
      error: result?.error ?? null,
    } satisfies RepositoryRunsResult;
  });
}

export function useActivity(params: {
  repositoryId?: string;
  status?: string;
  operation?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ["activity", params],
    queryFn: () => api.listActivity(params),
    refetchInterval: 5000,
  });
}

export function useActivityEvent(logId: string | undefined) {
  return useQuery({
    queryKey: ["activity-event", logId],
    queryFn: async () => (await api.getActivity(logId as string)).event,
    enabled: Boolean(logId),
  });
}

export function useRun(runId: string | undefined) {
  return useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.getRun(runId as string),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.run.status;
      return status && ["QUEUED", "RUNNING", "RETRYING"].includes(status) ? 3000 : false;
    },
  });
}

export function useProposal(runId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["proposal", runId],
    queryFn: () => api.getProposal(runId as string),
    enabled: Boolean(runId) && enabled,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
    refetchInterval: (query) => (query.state.data ? false : 4000),
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Sign in with GitHub again.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

function useInvalidator() {
  const client = useQueryClient();
  return (...keys: string[]) => {
    for (const key of keys) {
      void client.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useRepositoryActions(repositoryId: string) {
  const toast = useToast();
  const invalidate = useInvalidator();

  const start = useMutation({
    mutationFn: (operation: "generate" | "update" | "cleanup") => {
      if (operation === "generate") return api.generate(repositoryId);
      if (operation === "update") return api.update(repositoryId);
      return api.cleanup(repositoryId);
    },
    onSuccess: (_data, operation) => {
      toast.push({
        title:
          operation === "generate"
            ? "README generation queued"
            : operation === "update"
              ? "Incremental update queued"
              : "Cleanup queued",
        description: "Progress appears in Activity as the worker processes it.",
        variant: "success",
      });
      invalidate("repositories", "repository", "activity");
    },
    onError: (error) => {
      toast.push({ title: "Could not queue the run", description: errorMessage(error), variant: "error" });
    },
  });

  return { start };
}

export function useCancelRun() {
  const toast = useToast();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: (runId: string) => api.cancelRun(runId),
    onSuccess: () => {
      toast.push({
        title: "Run cancelled",
        description: "The worker stops before its next GitHub write.",
        variant: "success",
      });
      invalidate("run", "repository", "repositories", "activity");
    },
    onError: (error) =>
      toast.push({ title: "Could not cancel run", description: errorMessage(error), variant: "error" }),
  });
}

export function useRepositorySettings(repositoryId: string) {
  const toast = useToast();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: (patch: Partial<RepoSettings>) => api.updateRepositorySettings(repositoryId, patch),
    onSuccess: () => {
      toast.push({ title: "Settings saved", variant: "success" });
      invalidate("repository", "repositories");
    },
    onError: (error) =>
      toast.push({ title: "Could not save settings", description: errorMessage(error), variant: "error" }),
  });
}

export function useConnectRepository() {
  const toast = useToast();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: (githubRepoId: number) => api.connectRepository(githubRepoId),
    onSuccess: (result) => {
      toast.push({ title: `Connected ${result.repository.fullName}`, variant: "success" });
      invalidate("repositories");
    },
    onError: (error) =>
      toast.push({ title: "Could not connect repository", description: errorMessage(error), variant: "error" }),
  });
}

export function useRepositoryTracking(repositoryId: string) {
  const toast = useToast();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: (status: "CONNECTED" | "PAUSED") => api.setTracking(repositoryId, status),
    onSuccess: (_data, status) => {
      toast.push({
        title: status === "PAUSED" ? "Automatic tracking paused" : "Automatic tracking resumed",
        variant: "success",
      });
      invalidate("repository", "repositories");
    },
    onError: (error) =>
      toast.push({ title: "Could not update tracking", description: errorMessage(error), variant: "error" }),
  });
}

export function useDisconnectRepository(repositoryId: string) {
  const toast = useToast();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: (revokeAuthorization: boolean) =>
      api.disconnectRepository(repositoryId, revokeAuthorization),
    onSuccess: (result) => {
      toast.push({
        title: "Repository disconnected",
        description: result.authorizationRevoked
          ? "GitHub authorization was revoked and sessions were ended."
          : "Webhook updates for this repository will be ignored.",
        variant: "success",
      });
      invalidate("repositories", "repository", "me");
    },
    onError: (error) =>
      toast.push({ title: "Could not disconnect", description: errorMessage(error), variant: "error" }),
  });
}

export function useReviewActions() {
  const toast = useToast();
  const invalidate = useInvalidator();
  return {
    approve: useMutation({
      mutationFn: (proposalId: string) => api.approveProposal(proposalId),
      onSuccess: () => {
        toast.push({ title: "Proposal approved", description: "Applying to GitHub now.", variant: "success" });
        invalidate("proposal", "run", "repository", "repositories", "activity");
      },
      onError: (error) =>
        toast.push({ title: "Could not approve proposal", description: errorMessage(error), variant: "error" }),
    }),
    reject: useMutation({
      mutationFn: (proposalId: string) => api.rejectProposal(proposalId),
      onSuccess: () => {
        toast.push({ title: "Proposal rejected", description: "The README was not modified." });
        invalidate("proposal", "run", "repository", "repositories", "activity");
      },
      onError: (error) =>
        toast.push({ title: "Could not reject proposal", description: errorMessage(error), variant: "error" }),
    }),
    retry: useMutation({
      mutationFn: (runId: string) => api.retryRun(runId),
      onSuccess: () => {
        toast.push({ title: "New run queued", variant: "success" });
        invalidate("run", "repository", "repositories", "activity");
      },
      onError: (error) =>
        toast.push({ title: "Could not retry run", description: errorMessage(error), variant: "error" }),
    }),
  };
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => client.clear(),
  });
}

export { errorMessage };
