import {
  GitHubClient,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  revokeGitHubOAuthToken,
} from "@commitscibble/github";
import { AppError, ERROR_CODES, type AvailableRepository } from "@commitscibble/shared";
import { User, type UserDocument } from "@commitscibble/persistence";
import type { Env } from "@commitscibble/config";
import { decryptGitHubToken, encryptGitHubToken } from "../lib/crypto.js";
import { toSessionUser } from "../lib/session.js";
import type { SessionUser } from "@commitscibble/shared";

export class GithubAccountService {
  constructor(private readonly env: Env) {}

  authorizeUrl(state: string): string {
    return buildAuthorizeUrl({
      clientId: this.env.GITHUB_CLIENT_ID as string,
      redirectUri: this.env.GITHUB_CALLBACK_URL as string,
      state,
    });
  }

  async completeAuthorization(code: string): Promise<{ user: UserDocument; sessionUser: SessionUser }> {
    const token = await exchangeCodeForToken({
      clientId: this.env.GITHUB_CLIENT_ID as string,
      clientSecret: this.env.GITHUB_CLIENT_SECRET as string,
      code,
      redirectUri: this.env.GITHUB_CALLBACK_URL as string,
    });

    const client = new GitHubClient({
      token: token.accessToken,
      baseUrl: this.env.GITHUB_API_BASE_URL,
    });
    const profile = await client.getAuthenticatedUser();

    const encrypted = encryptGitHubToken(
      token.accessToken,
      this.env.TOKEN_ENCRYPTION_KEY as string,
    );
    const scopes = token.scope.split(/[\s,]+/).filter(Boolean);

    const user = await User.findOneAndUpdate(
      { githubId: profile.id },
      {
        $set: {
          githubLogin: profile.login,
          displayName: profile.name ?? null,
          email: profile.email ?? null,
          avatarUrl: profile.avatar_url ?? null,
          githubTokenEncrypted: encrypted,
          tokenScopes: scopes,
          tokenUpdatedAt: new Date(),
          status: "ACTIVE",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return { user, sessionUser: toSessionUser(user) };
  }

  async clientForUser(userId: string): Promise<GitHubClient> {
    const user = await User.findById(userId).select("+githubTokenEncrypted");
    if (!user || !user.githubTokenEncrypted) {
      throw new AppError(
        ERROR_CODES.GITHUB_UNAUTHORIZED,
        "GitHub authorization is missing or was revoked. Sign in with GitHub again.",
        { httpStatus: 401 },
      );
    }
    let token: string;
    try {
      token = decryptGitHubToken(user.githubTokenEncrypted, this.env.TOKEN_ENCRYPTION_KEY as string);
    } catch {
      throw new AppError(
        ERROR_CODES.GITHUB_UNAUTHORIZED,
        "Stored GitHub credentials could not be decrypted. Sign in again to reauthorize.",
        { httpStatus: 401 },
      );
    }
    return new GitHubClient({ token, baseUrl: this.env.GITHUB_API_BASE_URL });
  }

  async listRepositories(userId: string): Promise<AvailableRepository[]> {
    const client = await this.clientForUser(userId);
    const repositories = await client.listRepositories(this.env.GITHUB_REPOSITORY_LIMIT);
    return repositories.map((repository) => ({
      githubRepoId: repository.id,
      owner: repository.owner.login,
      name: repository.name,
      fullName: repository.full_name,
      defaultBranch: repository.default_branch,
      private: repository.private,
      htmlUrl: repository.html_url,
      description: repository.description ?? null,
      connectedRepositoryId: null,
    }));
  }

  /** Revoke the OAuth grant. Returns false when GitHub no longer recognizes it. */
  async revoke(userId: string): Promise<boolean> {
    const user = await User.findById(userId).select("+githubTokenEncrypted");
    if (!user || !user.githubTokenEncrypted) return false;
    let token: string;
    try {
      token = decryptGitHubToken(user.githubTokenEncrypted, this.env.TOKEN_ENCRYPTION_KEY as string);
    } catch {
      return false;
    }
    let revoked = false;
    try {
      revoked = await revokeGitHubOAuthToken({
        clientId: this.env.GITHUB_CLIENT_ID as string,
        clientSecret: this.env.GITHUB_CLIENT_SECRET as string,
        token,
        baseUrl: this.env.GITHUB_API_BASE_URL,
      });
    } finally {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            githubTokenEncrypted: null,
            tokenScopes: [],
            tokenUpdatedAt: null,
            status: "DISCONNECTED",
          },
        },
      );
    }
    return revoked;
  }
}
