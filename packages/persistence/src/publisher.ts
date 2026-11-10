import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import type { ActivityEvent } from "@commitscibble/shared";
import { deriveRealtimeReadKey } from "@commitscibble/shared/node";

export interface PublishResult {
  status: "PUBLISHED" | "SKIPPED";
  reason?: string;
}

export interface ActivityPublisher {
  publish(event: ActivityEvent): Promise<PublishResult>;
}

export class NullActivityPublisher implements ActivityPublisher {
  async publish(): Promise<PublishResult> {
    return { status: "SKIPPED", reason: "CONVEX_URL is not configured; UI falls back to polling" };
  }
}

export class ConvexActivityPublisher implements ActivityPublisher {
  private readonly client: ConvexHttpClient;
  private readonly token: string;

  constructor(options: { url: string; token: string }) {
    this.client = new ConvexHttpClient(options.url);
    this.token = options.token;
  }

  async publish(event: ActivityEvent): Promise<PublishResult> {
    await this.client.mutation(anyApi.activity.append, {
      token: this.token,
      event: {
        ...event,
        readKey: deriveRealtimeReadKey(this.token, event.userId),
      },
    });
    return { status: "PUBLISHED" };
  }
}

export function createActivityPublisher(config: { url: string; token: string } | null): ActivityPublisher {
  return config ? new ConvexActivityPublisher(config) : new NullActivityPublisher();
}
