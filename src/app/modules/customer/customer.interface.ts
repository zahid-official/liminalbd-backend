import type { UserRole } from "../../../generated/prisma/enums.js";
import type {
  DeleteCustomerBody,
  GetCustomersQuery,
  RegisterCustomerBody,
  UpdateCustomerStatusBody,
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

// Input contract for updating Customer account status
export interface UpdateCustomerStatusInput {
  actorId: string;
  actorRole: UserRole;
  customerId: string;
  payload: UpdateCustomerStatusBody;
}

// Input contract for soft-deleting a Customer account
export interface DeleteCustomerInput {
  actorId: string;
  actorRole: UserRole;
  customerId: string;
  payload?: DeleteCustomerBody;
}

