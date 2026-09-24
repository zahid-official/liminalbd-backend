import status from "http-status";
import {
  AuditAction,
  UserRole,
} from "../../../generated/prisma/enums.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import { AuditService } from "../audit/audit.service.js";
import type { CreateAuditLogInput } from "../audit/audit.interface.js";
import type {
  AuthorizeOwnershipInput,
  OwnershipPolicy,
} from "./authorization.interface.js";

// Check if administrative role is authorized by policy
const isAuthorizedRole = (role: UserRole, policy?: OwnershipPolicy): boolean => {
  // Customers can never possess administrative override access to other users' resources
  if (role === UserRole.CUSTOMER) {
    return false;
  }

  // If an explicit allow-list is provided, strictly evaluate against it
  if (policy?.allowedRoles) {
    return policy.allowedRoles.includes(role);
  }

  // Super Admin is permitted unless explicitly restricted
  if (role === UserRole.SUPER_ADMIN) {
    return policy?.allowSuperAdmin !== false;
  }

  // Admin is permitted only when explicitly enabled
  return role === UserRole.ADMIN && policy?.allowAdmin === true;
};

// Authorize Customer resource ownership and administrative access
const authorizeOwnership = async (
  input: AuthorizeOwnershipInput,
): Promise<void> => {
  const {
    actorId,
    actorRole,
    resourceOwnerId,
    resourceType,
    resourceId,
    action,
    policy,
    tx,
  } = input;

  // Direct resource owner is authorized
  if (actorId === resourceOwnerId) {
    return;
  }

  // Check administrative role policy
  if (isAuthorizedRole(actorRole, policy)) {
    return;
  }

  // Record security audit log for unauthorized access attempt
  const auditData: CreateAuditLogInput = {
    actorId,
    action: AuditAction.UNAUTHORIZED_ATTEMPT,
    entityType: resourceType,
    metadata: {
      attemptedAction: action,
      reason: "FORBIDDEN_ACCESS",
      resourceOwnerId,
    },
  };

  if (resourceId) {
    auditData.entityId = resourceId;
  }

  if (tx) {
    auditData.tx = tx;
  }

  await AuditService.record(auditData);

  throw new AppError(
    status.FORBIDDEN,
    PUBLIC_ERROR_CODES.FORBIDDEN_ACCESS,
    "You do not have permission to access or modify this resource",
  );
};

// Export authorization service
export const AuthorizationService = {
  authorizeOwnership,
};
