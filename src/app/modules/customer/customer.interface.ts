import type { RegisterCustomerBody } from "./customer.validation.js";

// Input contract for registering a Customer account
export interface RegisterCustomerInput {
  headers: Headers;
  payload: RegisterCustomerBody;
}
