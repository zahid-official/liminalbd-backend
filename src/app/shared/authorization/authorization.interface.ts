import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  AuditEntityType,
  UserRole,
} from "../../../generated/prisma/enums.js";

// Policy governing administrative role access to customer-owned resources
export interface OwnershipPolicy {
  allowAdmin?: boolean;
  allowSuperAdmin?: boolean;
  allowedRoles?: readonly UserRole[];
}

// Input contract for validating resource ownership and administrative access
export interface AuthorizeOwnershipInput {
  actorId: string;
  actorRole: UserRole;
  resourceOwnerId: string;
  resourceType: AuditEntityType;
  resourceId?: string;
  action: string;
  policy?: OwnershipPolicy;
  tx?: Prisma.TransactionClient;
}
