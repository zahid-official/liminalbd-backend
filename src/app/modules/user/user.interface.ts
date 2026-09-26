import type { UpdateProfileBody } from "./user.validation.js";

// Input contract for updating authenticated user profile
export interface UpdateProfileInput {
  userId: string;
  payload: UpdateProfileBody;
}
