import type { Env } from "@commitscibble/config";
import type { Logger } from "../lib/logger.js";
import type { JobQueue } from "../lib/queue.js";
import { GithubAccountService } from "./github-account.js";
import { RepositoryService } from "./repositories.js";
import { RunService } from "./runs.js";
import { ActivityService } from "./activity.js";
import { WebhookService } from "./webhooks.js";

export interface ServiceContainer {
  github: GithubAccountService;
  repositories: RepositoryService;
  runs: RunService;
  activity: ActivityService;
  webhooks: WebhookService;
}

export function createServices(env: Env, logger: Logger, queue: JobQueue): ServiceContainer {
  const github = new GithubAccountService(env);
  const repositories = new RepositoryService(env, github);
  const runs = new RunService(queue);
  const activity = new ActivityService();
  const webhooks = new WebhookService(repositories, queue, logger);
  return { github, repositories, runs, activity, webhooks };
}
