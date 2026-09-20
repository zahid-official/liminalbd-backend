import request from "supertest";
import { describe, expect, it } from "vitest";
import { PUBLIC_ERROR_CODES } from "../../src/app/errors/errorCodes.js";
import { getApp } from "../helpers/app.helper.js";

describe("Protected Routes Supertest Integration Tests", () => {
  const protectedPostEndpoints = [
    "/api/v1/auth/change-password",
    "/api/v1/auth/set-password",
    "/api/v1/auth/logout",
    "/api/v1/auth/logout-all",
    "/api/v1/auth/link/google",
    "/api/v1/auth/unlink/google",
  ];

  for (const endpoint of protectedPostEndpoints) {
    it(`should reject unauthenticated request to ${endpoint} with 401 UNAUTHORIZED`, async () => {
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
});
