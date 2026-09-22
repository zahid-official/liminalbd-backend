import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserStatus } from "../../../generated/prisma/enums.js";

// Input contract for updating a user's account status
export interface UpdateUserStatusInput {
  actorId?: string | null;
  targetUserId: string;
  newStatus: UserStatus;
  reason?: string | null;
  tx?: Prisma.TransactionClient;
}
