import type { Application } from "express";
import app from "../../src/app.js";

/**
 * Returns the configured Express application instance for integration tests.
 *
 * Usage with supertest:
 * ```ts
 * import request from "supertest";
 * import { getApp } from "../helpers/app.helper.js";
 *
 * const res = await request(getApp()).get("/");
 * expect(res.status).toBe(200);
 * ```
 *
 * The app is imported without starting the HTTP server (no app.listen),
 * so supertest handles the ephemeral port binding internally.
 */
const getApp = (): Application => app;

export { getApp };
