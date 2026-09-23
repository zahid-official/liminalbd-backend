import type { UserStatus } from "../../../generated/prisma/enums.js";

// Input contract for updating a user's account status
export interface UpdateUserStatusInput {
  actorId?: string;
  targetUserId: string;
  newStatus: UserStatus;
  reason?: string;
}

// Input contract for soft-deleting a user account
export interface SoftDeleteUserInput {
  actorId?: string;
  targetUserId: string;
  reason?: string;
}
