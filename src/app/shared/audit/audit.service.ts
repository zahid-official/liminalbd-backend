import type { AuditLog } from "../../../generated/prisma/client.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import type { CreateAuditLogInput } from "./audit.interface.js";

// Prisma type for direct actorId foreign-key insertion
type CreateAuditLogData = Prisma.AuditLogUncheckedCreateInput;

// Redacted sensitive keys before persisting audit records
const SENSITIVE_KEYS = new Set([
  "password",
  "currentpassword",
  "newpassword",
  "confirmpassword",
  "passwordhash",
  "hashedpassword",
  "token",
  "resettoken",
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "secret",
  "clientsecret",
  "authorization",
  "cookie",
  "credential",
  "apikey",
]);

// Recursively redact sensitive keys from audit payload
const sanitizePayload = (value: unknown): unknown => {
  if (value === null || typeof value !== "object" || value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayload(item));
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(value)) {
    // Normalize key to handle snake_case and kebab-case variants
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");

    if (SENSITIVE_KEYS.has(normalizedKey)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizePayload(val);
    }
  }

  return sanitized;
};

// Normalize object to valid Prisma JSON input
const toPrismaJson = (value: Record<string, unknown> | null) => {
  if (value === null) {
    return Prisma.JsonNull;
  }
  return sanitizePayload(value) as Prisma.InputJsonValue;
};

// Record an audit log entry atomically with optional transaction support
const record = async ({
  actorId,
  action,
  entityType,
  entityId,
  previousValue,
  newValue,
  metadata,
  tx,
}: CreateAuditLogInput): Promise<AuditLog> => {
  const client = tx ?? prisma;

  const data: CreateAuditLogData = {
    actorId: actorId ?? null,
    action,
    entityType,
    entityId: entityId ?? null,
  };

  if (previousValue !== undefined) {
    data.previousValue = toPrismaJson(previousValue);
  }
  if (newValue !== undefined) {
    data.newValue = toPrismaJson(newValue);
  }
  if (metadata !== undefined) {
    data.metadata = toPrismaJson(metadata);
  }

  const result = await client.auditLog.create({ data });
  return result;
};

// Export audit service
export const AuditService = {
  record,
};
