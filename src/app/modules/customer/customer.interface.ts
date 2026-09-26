import type { UserRole } from "../../../generated/prisma/enums.js";
import type {
  GetCustomersQuery,
  RegisterCustomerBody,
} from "./customer.validation.js";

// Input contract for registering a Customer account
export interface RegisterCustomerInput {
  headers: Headers;
  payload: RegisterCustomerBody;
}

// Input contract for listing Customer accounts
export interface GetCustomersInput {
  actorId: string;
  actorRole: UserRole;
  query: GetCustomersQuery;
}

