import type { Prisma } from "../../../generated/prisma/client.js";
import type { AuditAction, AuditEntityType } from "../../../generated/prisma/enums.js";

// Common audit metadata context supporting arbitrary additional properties
export interface AuditMetadata extends Record<string, unknown> {
  ip?: string;
  userAgent?: string;
  reason?: string;
  attemptedAction?: string;
  attemptedRole?: string;
  attemptedStatus?: string;
  attemptedPayload?: unknown;
  createdVia?: string;
  updatedVia?: string;
}

// Input contract for persisting an audit log entry
export interface CreateAuditLogInput {
  actorId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: AuditMetadata;
  tx?: Prisma.TransactionClient;
}
