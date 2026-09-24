import type { UserRole } from "../../../generated/prisma/enums.js";

// Input contract for retrieving a Customer profile
export interface GetCustomerProfileServiceInput {
  actorId: string;
  actorRole: UserRole;
  targetId: string;
}
