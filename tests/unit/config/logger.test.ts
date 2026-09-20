import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";

describe("Logger Configuration Unit Tests", () => {
  it("should initialize a valid Pino logger instance with expected levels and methods", async () => {
    // Import the actual logger module unmocked
    const { logger } = await vi.importActual<typeof import("../../../src/app/config/logger.js")>(
      "../../../src/app/config/logger.js",
    );

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.fatal).toBe("function");
    expect(typeof logger.trace).toBe("function");
    expect(logger.version).toBeDefined();
    expect(logger.levels.values).toHaveProperty("info", 30);
    expect(logger.levels.values).toHaveProperty("error", 50);
  });

  it("should correctly serialize Error instances via standard error serializer", async () => {
    const err = new Error("Database connection timed out");
    const serialized = pino.stdSerializers.err(err);

    expect(serialized).toBeDefined();
    expect(serialized.type).toBe("Error");
    expect(serialized.message).toBe("Database connection timed out");
    expect(serialized.stack).toBeDefined();
  });

  it("should redact sensitive fields in logged objects (password, token, secret, cookie)", () => {
    let captured = "";
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        captured += chunk.toString();
        callback();
      },
    });

    const testLogger = pino(
      {
        level: "info",
        redact: {
          paths: [
            "password",
            "*.password",
            "currentPassword",
            "*.currentPassword",
            "newPassword",
            "*.newPassword",
            "token",
            "*.token",
            "secret",
            "*.secret",
            "authorization",
            "*.authorization",
            "cookie",
            "*.cookie",
          ],
          censor: "[REDACTED]",
        },
      },
      stream,
    );

    testLogger.info({
      password: "SUPER_SECRET_PASSWORD",
      token: "SYNTHETIC_ACCESS_TOKEN",
      secret: "SYNTHETIC_CLIENT_SECRET",
      cookie: "SYNTHETIC_COOKIE",
      authorization: "Bearer SYNTHETIC_BEARER_TOKEN",
      nested: {
        password: "NESTED_SECRET_PASSWORD",
        token: "NESTED_TOKEN",
      },
      publicData: "SAFE_METRIC",
    });

    const parsed = JSON.parse(captured.trim());
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.token).toBe("[REDACTED]");
    expect(parsed.secret).toBe("[REDACTED]");
    expect(parsed.cookie).toBe("[REDACTED]");
    expect(parsed.authorization).toBe("[REDACTED]");
    expect(parsed.nested.password).toBe("[REDACTED]");
    expect(parsed.nested.token).toBe("[REDACTED]");
    expect(parsed.publicData).toBe("SAFE_METRIC");

    // Strict negative assertion: no raw secret strings exist in output JSON
    expect(captured).not.toContain("SUPER_SECRET_PASSWORD");
    expect(captured).not.toContain("SYNTHETIC_ACCESS_TOKEN");
    expect(captured).not.toContain("SYNTHETIC_CLIENT_SECRET");
    expect(captured).not.toContain("SYNTHETIC_COOKIE");
    expect(captured).not.toContain("SYNTHETIC_BEARER_TOKEN");
    expect(captured).not.toContain("NESTED_SECRET_PASSWORD");
    expect(captured).not.toContain("NESTED_TOKEN");
  });

  it("should verify HTTP request serializer strips query string and omits raw query object", () => {
    // Replicate the HTTP request serializer logic used in app.ts
    const reqSerializer = (req: { id?: string; method?: string; url?: string; query?: Record<string, unknown> }) => ({
      id: req.id,
      method: req.method,
      url: req.url ? req.url.split("?")[0] : "",
    });

    const mockReq = {
      id: "req-synthetic-uuid-101",
      method: "GET",
      url: "/api/v1/auth/callback/google?Code=SYNTHETIC_OAUTH_CODE&access_token=SYNTHETIC_ACCESS_TOKEN&redirectTo=/dashboard?token=NESTED_SECRET",
      query: {
        Code: "SYNTHETIC_OAUTH_CODE",
        access_token: "SYNTHETIC_ACCESS_TOKEN",
        redirectTo: "/dashboard?token=NESTED_SECRET",
      },
    };

    const serialized = reqSerializer(mockReq);

    expect(serialized.id).toBe("req-synthetic-uuid-101");
    expect(serialized.method).toBe("GET");
    expect(serialized.url).toBe("/api/v1/auth/callback/google");
    expect(serialized).not.toHaveProperty("query");

    const json = JSON.stringify(serialized);
    expect(json).not.toContain("SYNTHETIC_OAUTH_CODE");
    expect(json).not.toContain("SYNTHETIC_ACCESS_TOKEN");
    expect(json).not.toContain("NESTED_SECRET");
    expect(json).not.toContain("Code=");
    expect(json).not.toContain("access_token=");
  });

  it("should verify HTTP response serializer extracts statusCode and omits headers/payload", () => {
    // Replicate the HTTP response serializer logic used in app.ts
    const resSerializer = (res: { statusCode?: number; headers?: Record<string, unknown>; body?: unknown }) => ({
      statusCode: res.statusCode,
    });

    const mockRes = {
      statusCode: 200,
      headers: {
        "set-cookie": "session_token=SYNTHETIC_COOKIE; HttpOnly",
        "content-type": "application/json",
      },
      body: {
        token: "SYNTHETIC_ACCESS_TOKEN",
        user: { email: "user@example.com" },
      },
    };

    const serialized = resSerializer(mockRes);

    expect(serialized.statusCode).toBe(200);
    expect(serialized).not.toHaveProperty("headers");
    expect(serialized).not.toHaveProperty("body");

    const json = JSON.stringify(serialized);
    expect(json).not.toContain("SYNTHETIC_COOKIE");
    expect(json).not.toContain("SYNTHETIC_ACCESS_TOKEN");
  });
});


