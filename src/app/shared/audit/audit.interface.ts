import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  AuditAction,
  AuditEntityType,
} from "../../../generated/prisma/enums.js";

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
  actorId?: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: AuditMetadata | null;
  tx?: Prisma.TransactionClient;
}
