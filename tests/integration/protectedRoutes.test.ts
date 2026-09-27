import request from "supertest";
import { describe, expect, it } from "vitest";
import { PUBLIC_ERROR_CODES } from "../../src/app/errors/errorCodes.js";
import { getApp } from "../helpers/app.helper.js";

describe("Protected Routes Supertest Integration Tests", () => {
  const sampleUuid = "11111111-1111-4111-8111-111111111111";

  const protectedGetEndpoints = [
    "/api/v1/users/profile",
    "/api/v1/customers",
    `/api/v1/customers/${sampleUuid}`,
    "/api/v1/admins",
  ];

  for (const endpoint of protectedGetEndpoints) {
    it(`should reject unauthenticated GET request to ${endpoint} with 401 UNAUTHORIZED`, async () => {
      const res = await request(getApp()).get(endpoint);

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required. Please sign in.",
      });
    });
  }

  const protectedPostEndpoints = [
    "/api/v1/auth/change-password",
    "/api/v1/auth/set-password",
    "/api/v1/auth/logout",
    "/api/v1/auth/logout-all",
    "/api/v1/auth/link/google",
    "/api/v1/auth/unlink/google",
    "/api/v1/admins",
  ];

  for (const endpoint of protectedPostEndpoints) {
    it(`should reject unauthenticated POST request to ${endpoint} with 401 UNAUTHORIZED`, async () => {
      const res = await request(getApp())
        .post(endpoint)
        .send({});

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required. Please sign in.",
      });
    });
  }

  const protectedPatchEndpoints = [
    "/api/v1/users/profile",
    `/api/v1/customers/${sampleUuid}/status`,
    `/api/v1/admins/${sampleUuid}`,
  ];

  for (const endpoint of protectedPatchEndpoints) {
    it(`should reject unauthenticated PATCH request to ${endpoint} with 401 UNAUTHORIZED`, async () => {
      const res = await request(getApp())
        .patch(endpoint)
        .send({});

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required. Please sign in.",
      });
    });
  }

  const protectedDeleteEndpoints = [
    `/api/v1/customers/${sampleUuid}`,
  ];

  for (const endpoint of protectedDeleteEndpoints) {
    it(`should reject unauthenticated DELETE request to ${endpoint} with 401 UNAUTHORIZED`, async () => {
      const res = await request(getApp())
        .delete(endpoint);

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required. Please sign in.",
      });
    });
  }
});
