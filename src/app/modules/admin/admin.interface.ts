import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserRole } from "../../../generated/prisma/enums.js";
import type { CreateAdminInput, UpdateAdminInput } from "./admin.validation.js";

// Input contract for creating an Admin account
export interface CreateAdminServiceInput {
  actorId: string;
  actorRole: UserRole;
  payload: CreateAdminInput;
  tx?: Prisma.TransactionClient;
}

// Input contract for updating an Admin account
export interface UpdateAdminServiceInput {
  actorId: string;
  actorRole: UserRole;
  targetId: string;
  payload: UpdateAdminInput;
  tx?: Prisma.TransactionClient;
}
