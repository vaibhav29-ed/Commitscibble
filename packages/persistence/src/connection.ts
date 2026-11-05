import mongoose from "mongoose";
import { AuditLog, WebhookDelivery } from "./models.js";

export interface ConnectOptions {
  uri: string;
  dbName?: string;
  serverSelectionTimeoutMS?: number;
}

export async function connectDatabase(options: ConnectOptions): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(options.uri, {
    dbName: options.dbName,
    serverSelectionTimeoutMS: options.serverSelectionTimeoutMS ?? 10_000,
    maxPoolSize: 10,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function databaseState(): "connected" | "connecting" | "disconnected" | "disconnecting" {
  switch (mongoose.connection.readyState) {
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
    default:
      return "disconnected";
  }
}

export async function pingDatabase(): Promise<boolean> {
  if (mongoose.connection.readyState !== 1) return false;
  const db = mongoose.connection.db;
  if (!db) return false;
  await db.admin().ping();
  return true;
}

/**
 * Older builds declared the run-scoped `logId` correlation id as unique, which
 * made every audit event after the first one for a run fail with E11000. Repair
 * the index in place so existing databases heal on startup.
 */
async function ensureAuditLogIndexes(): Promise<void> {
  const indexes = await AuditLog.collection.indexes().catch((error: unknown) => {
    if ((error as { code?: number }).code === 26) return [];
    throw error;
  });
  const logIdIndex = indexes.find((index) => {
    const key = index.key as Record<string, unknown> | undefined;
    if (!key) return false;
    const fields = Object.keys(key);
    return fields.length === 1 && fields[0] === "logId" && key.logId === 1;
  });
  if (logIdIndex?.unique) {
    await AuditLog.collection.dropIndex(String(logIdIndex.name));
  }
  await AuditLog.collection.createIndex({ logId: 1 }, { name: "logId_1" });
}

/**
 * TTL retention is enforced by MongoDB, not by application sweeps. Run this at
 * startup so retention changes in configuration take effect.
 */
export async function initializeIndexes(options: {
  auditRetentionDays: number;
  webhookRetentionDays: number;
}): Promise<void> {
  await ensureAuditLogIndexes();
  await AuditLog.collection.createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: options.auditRetentionDays * 86_400, name: "audit_retention_ttl" },
  );
  await WebhookDelivery.collection.createIndex(
    { receivedAt: 1 },
    { expireAfterSeconds: options.webhookRetentionDays * 86_400, name: "webhook_retention_ttl" },
  );
}
