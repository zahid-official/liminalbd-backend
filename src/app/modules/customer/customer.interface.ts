import type { UserRole } from "../../../generated/prisma/enums.js";
import type { RegisterCustomerInput } from "./customer.validation.js";

// Input contract for registering a Customer account
export interface RegisterCustomerData {
  payload: RegisterCustomerInput;
  headers: Headers;
}

// Input contract for retrieving a Customer profile
export interface GetCustomerProfileInput {
  actorId: string;
  actorRole: UserRole;
  targetId: string;
}
