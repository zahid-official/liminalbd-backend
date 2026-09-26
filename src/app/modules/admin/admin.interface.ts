import type { UserRole } from "../../../generated/prisma/enums.js";
import type {
  CreateAdminBody,
  GetAdminsQuery,
  UpdateAdminBody,
} from "./admin.validation.js";

// Input contract for creating an Admin account
export interface CreateAdminInput {
  actorId: string;
  actorRole: UserRole;
  payload: CreateAdminBody;
}

// Input contract for updating an Admin account
export interface UpdateAdminInput {
  actorId: string;
  actorRole: UserRole;
  targetId: string;
  payload: UpdateAdminBody;
}

// Input contract for listing Admin accounts
export interface GetAdminsInput {
  actorId: string;
  actorRole: UserRole;
  query: GetAdminsQuery;
}
