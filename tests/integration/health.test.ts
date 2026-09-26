import request from "supertest";
import { describe, expect, it } from "vitest";
import { getApp } from "../helpers/app.helper.js";

describe("GET / (Health Check Integration)", () => {
  it("should return 200 with healthy status response payload", async () => {
    const res = await request(getApp()).get("/");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: "Liminal Backend API is running successfully",
      data: expect.objectContaining({
        timestamp: expect.any(String),
      }),
    });
  });
});
