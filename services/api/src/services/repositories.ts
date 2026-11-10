import {
  AppError,
  ERROR_CODES,
  type AvailableRepository,
  type ProposalSummary,
  type RepoSettings,
  type RepositoryRecord,
  type RunSummary,
} from "@commitscibble/shared";
import {
  DocumentationProposal,
  DocumentationRun,
  Repository,
  recordActivity,
  type RepositoryDocument,
  type RepositorySettingsShape,
} from "@commitscibble/persistence";
import type { Env } from "@commitscibble/config";
import type { GithubAccountService } from "./github-account.js";
import { toProposalSummary, toRunSummary } from "./runs.js";
import { GitHubError } from "@commitscibble/github";

export function defaultSettings(env: Env): RepositorySettingsShape {
  return {
    readmePath: env.README_FILE_NAME,
    targetBranch: null,
    updateMode: env.DOC_UPDATE_MODE,
    automationEnabled: true,
    ignoredPaths: [],
    maintainedSections: [],
    commitMessageTemplate: "docs: update {readmePath} [commitscibble]",
  };
}

export function toRepositoryRecord(doc: RepositoryDocument): RepositoryRecord {
  const settings: RepoSettings = {
    readmePath: doc.settings.readmePath,
    targetBranch: doc.settings.targetBranch,
    updateMode: doc.settings.updateMode,
    automationEnabled: doc.settings.automationEnabled,
    ignoredPaths: [...doc.settings.ignoredPaths],
    maintainedSections: [...doc.settings.maintainedSections],
    commitMessageTemplate: doc.settings.commitMessageTemplate,
  };
  return {
    id: String(doc._id),
    githubRepoId: doc.githubRepoId,
    owner: doc.owner,
    name: doc.name,
    fullName: doc.fullName,
    defaultBranch: doc.defaultBranch,
    private: doc.private,
    htmlUrl: doc.htmlUrl,
    description: doc.description,
    trackingStatus: doc.trackingStatus,
    settings,
    lastProcessedCommitSha: doc.lastProcessedCommitSha,
    lastSuccessfulRunAt: doc.lastSuccessfulRunAt ? doc.lastSuccessfulRunAt.toISOString() : null,
    documentationStatus: doc.documentationStatus,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export interface ConnectedRepositoryView extends RepositoryRecord {
  pendingProposalId: string | null;
  pendingProposalRunId: string | null;
  lastRun: RunSummary | null;
  readmeUrl: string;
}

export interface RepositoryDetailView {
  repository: ConnectedRepositoryView;
  runs: RunSummary[];
  pendingProposal: ProposalSummary | null;
}

export class RepositoryService {
  constructor(
    private readonly env: Env,
    private readonly github: GithubAccountService,
  ) {}

  async list(userId: string): Promise<{
    available: AvailableRepository[];
    connected: ConnectedRepositoryView[];
    githubError: string | null;
  }> {
    const connectedDocs = await Repository.find({ userId, trackingStatus: { $ne: "DISCONNECTED" } }).sort({
      createdAt: -1,
    });
    const connected = await Promise.all(connectedDocs.map((doc) => this.toView(doc)));

    let available: AvailableRepository[] = [];
    let githubError: string | null = null;
    try {
      const repos = await this.github.listRepositories(userId);
      const byGithubId = new Map(connectedDocs.map((doc) => [doc.githubRepoId, String(doc._id)]));
      available = repos.map((repo) => ({
        ...repo,
        connectedRepositoryId: byGithubId.get(repo.githubRepoId) ?? null,
      }));
    } catch (error) {
      githubError =
        error instanceof AppError
          ? error.message
          : "GitHub repositories could not be listed. Reconnect your GitHub account.";
    }

    return { available, connected, githubError };
  }

  async connect(
    userId: string,
    githubRepoId: number,
    options: { readmePath?: string; updateMode?: "AUTOMATIC" | "REVIEW" },
  ): Promise<ConnectedRepositoryView> {
    const available = await this.github.listRepositories(userId);
    const target = available.find((repo) => repo.githubRepoId === githubRepoId);
    if (!target) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        "This repository is not accessible with your current GitHub authorization.",
        { httpStatus: 403 },
      );
    }

    const settings = {
      ...defaultSettings(this.env),
      ...(options.readmePath ? { readmePath: options.readmePath } : {}),
      ...(options.updateMode ? { updateMode: options.updateMode } : {}),
    };

    const doc = await Repository.findOneAndUpdate(
      { userId, githubRepoId },
      {
        $set: {
          owner: target.owner,
          name: target.name,
          fullName: target.fullName,
          defaultBranch: target.defaultBranch,
          private: target.private,
          htmlUrl: target.htmlUrl,
          description: target.description,
          trackingStatus: "CONNECTED",
          disconnectedAt: null,
        },
        $setOnInsert: { settings },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const installationId = await this.github.installationIdFor(userId).catch(() => null);
    let repositoryInstallationId: number | null = null;
    if (installationId) {
      try {
        const installationClient = await this.github.clientForInstallation(installationId);
        await installationClient.getRepository(doc.owner, doc.name);
        repositoryInstallationId = installationId;
      } catch {
        repositoryInstallationId = null;
      }
    }
    if (doc.githubInstallationId !== repositoryInstallationId) {
      doc.githubInstallationId = repositoryInstallationId;
      await doc.save();
    }

    await recordActivity({
      userId,
      repositoryId: doc._id,
      repositoryFullName: doc.fullName,
      type: "SUCCESS",
      message: `Connected ${doc.fullName} to CommitScibble`,
      metadata: { action: "connect" },
    });

    return this.toView(doc);
  }

  async get(userId: string, id: string): Promise<RepositoryDetailView> {
    const doc = await this.findOwned(userId, id);
    const [runs, pending] = await Promise.all([
      DocumentationRun.find({ repositoryId: doc._id })
        .sort({ createdAt: -1 })
        .limit(10),
      DocumentationProposal.findOne({ repositoryId: doc._id, status: "PENDING" }).sort({
        createdAt: -1,
      }),
    ]);
    return {
      repository: await this.toView(doc),
      runs: runs.map((run) => toRunSummary(run)),
      pendingProposal: pending ? toProposalSummary(pending) : null,
    };
  }

  async updateSettings(
    userId: string,
    id: string,
    patch: Partial<RepoSettings>,
  ): Promise<RepositoryRecord> {
    const doc = await this.findOwned(userId, id);

    if (patch.targetBranch) {
      const client = await this.github.clientForUser(userId);
      try {
        await client.getBranch(doc.owner, doc.name, patch.targetBranch);
      } catch (error) {
        if (error instanceof GitHubError && error.code === ERROR_CODES.GITHUB_NOT_FOUND) {
          throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            `Branch "${patch.targetBranch}" does not exist in ${doc.fullName}.`,
            { httpStatus: 422 },
          );
        }
        throw error;
      }
    }

    if (patch.targetBranch !== undefined) doc.settings.targetBranch = patch.targetBranch;
    if (patch.readmePath !== undefined) doc.settings.readmePath = patch.readmePath;
    if (patch.updateMode !== undefined) doc.settings.updateMode = patch.updateMode;
    if (patch.automationEnabled !== undefined) doc.settings.automationEnabled = patch.automationEnabled;
    if (patch.ignoredPaths !== undefined) doc.settings.ignoredPaths = patch.ignoredPaths;
    if (patch.maintainedSections !== undefined) doc.settings.maintainedSections = patch.maintainedSections;
    if (patch.commitMessageTemplate !== undefined) {
      doc.settings.commitMessageTemplate = patch.commitMessageTemplate;
    }
    await doc.save();

    await recordActivity({
      userId,
      repositoryId: doc._id,
      repositoryFullName: doc.fullName,
      type: "SUCCESS",
      message: `Updated documentation settings for ${doc.fullName}`,
      metadata: { action: "settings" },
    });

    return toRepositoryRecord(doc);
  }

  async setTracking(
    userId: string,
    id: string,
    status: "CONNECTED" | "PAUSED",
  ): Promise<RepositoryRecord> {
    const doc = await this.findOwned(userId, id);
    doc.trackingStatus = status;
    await doc.save();
    await recordActivity({
      userId,
      repositoryId: doc._id,
      repositoryFullName: doc.fullName,
      type: "SUCCESS",
      message:
        status === "PAUSED"
          ? `Paused automatic tracking for ${doc.fullName}`
          : `Resumed tracking for ${doc.fullName}`,
      metadata: { action: "tracking", status },
    });
    return toRepositoryRecord(doc);
  }

  async disconnect(
    userId: string,
    id: string,
    options: { revokeAuthorization: boolean },
  ): Promise<{ repository: RepositoryRecord; authorizationRevoked: boolean }> {
    const doc = await this.findOwned(userId, id);
    doc.trackingStatus = "DISCONNECTED";
    doc.disconnectedAt = new Date();
    await doc.save();

    await recordActivity({
      userId,
      repositoryId: doc._id,
      repositoryFullName: doc.fullName,
      type: "CANCELLED",
      message: `Disconnected ${doc.fullName}; webhook updates will be ignored`,
      metadata: { action: "disconnect" },
    });

    let authorizationRevoked = false;
    if (options.revokeAuthorization) {
      authorizationRevoked = await this.github.revoke(userId);
      await Repository.updateMany(
        { userId, _id: { $ne: doc._id }, trackingStatus: { $ne: "DISCONNECTED" } },
        { $set: { trackingStatus: "DISCONNECTED", disconnectedAt: new Date() } },
      );
    }

    return { repository: toRepositoryRecord(doc), authorizationRevoked };
  }

  async findOwned(userId: string, id: string): Promise<RepositoryDocument> {
    const doc = await Repository.findOne({ _id: id, userId });
    if (!doc) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Repository not found", { httpStatus: 404 });
    }
    return doc;
  }

  async findConnectedByGithubId(
    githubRepoId: number,
  ): Promise<RepositoryDocument | null> {
    return Repository.findOne({ githubRepoId, trackingStatus: "CONNECTED" });
  }

  private async toView(doc: RepositoryDocument): Promise<ConnectedRepositoryView> {
    const [pending, lastRun] = await Promise.all([
      DocumentationProposal.findOne({ repositoryId: doc._id, status: "PENDING" })
        .sort({ createdAt: -1 })
        .select("_id runId"),
      DocumentationRun.findOne({ repositoryId: doc._id }).sort({ createdAt: -1 }),
    ]);
    const branch = doc.settings.targetBranch ?? doc.defaultBranch;
    return {
      ...toRepositoryRecord(doc),
      pendingProposalId: pending ? String(pending._id) : null,
      pendingProposalRunId: pending?.runId ? String(pending.runId) : null,
      lastRun: lastRun ? toRunSummary(lastRun) : null,
      readmeUrl: `${doc.htmlUrl}/blob/${encodeURIComponent(branch)}/${doc.settings.readmePath}`,
    };
  }
}
