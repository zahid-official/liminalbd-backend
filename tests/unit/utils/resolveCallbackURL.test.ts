import { describe, expect, it } from "vitest";
import { env } from "../../../src/app/config/env.js";
import { resolveCallbackURL } from "../../../src/app/utils/resolveCallbackURL.js";

describe("resolveCallbackURL Unit Tests", () => {
  describe("Default and Empty Input Handling", () => {
    it("should return trusted frontend URL with default /dashboard path when redirectTo is undefined", () => {
      const result = resolveCallbackURL(undefined);
      expect(result).toBe(`${env.FRONTEND_URL}/dashboard`);
    });

    it("should return trusted frontend URL with default /dashboard path when redirectTo is empty string", () => {
      const result = resolveCallbackURL("");
      expect(result).toBe(`${env.FRONTEND_URL}/dashboard`);
    });

    it("should respect custom defaultPath when redirectTo is omitted", () => {
      const result = resolveCallbackURL(undefined, "/custom-landing");
      expect(result).toBe(`${env.FRONTEND_URL}/custom-landing`);
    });
  });

  describe("Open Redirect & Protocol-Relative URL Defense", () => {
    it("should reject protocol-relative URLs and fall back to default trusted path", () => {
      const result = resolveCallbackURL("//evil.com/phishing");
      expect(result).toBe(`${env.FRONTEND_URL}/dashboard`);
    });

    it("should reject protocol-relative URLs with custom defaultPath", () => {
      const result = resolveCallbackURL("//attacker.com", "/home");
      expect(result).toBe(`${env.FRONTEND_URL}/home`);
    });
  });

  describe("Absolute URL Validation", () => {
    it("should allow absolute URLs matching the trusted frontend origin exactly", () => {
      const trustedOrigin = new URL(env.FRONTEND_URL).origin;
      const targetUrl = `${trustedOrigin}/account/security?verified=true`;

      const result = resolveCallbackURL(targetUrl);
      expect(result).toBe(targetUrl);
    });

    it("should reject external absolute URLs with different origins and fall back safely", () => {
      const result = resolveCallbackURL(
        "https://evil-attacker.com/steal-token",
      );
      expect(result).toBe(`${env.FRONTEND_URL}/dashboard`);
    });

    it("should reject HTTP absolute URLs pointing to different domains", () => {
      const result = resolveCallbackURL(
        "http://untrusted-site.com/callback",
        "/auth/login",
      );
      expect(result).toBe(`${env.FRONTEND_URL}/auth/login`);
    });

    it("should safely catch malformed URLs and fall back to default trusted path", () => {
      const result = resolveCallbackURL("https://[invalid-url-domain");
      expect(result).toBe(`${env.FRONTEND_URL}/dashboard`);
    });
  });

  describe("Relative Path Handling", () => {
    it("should resolve valid relative paths with a leading slash", () => {
      const result = resolveCallbackURL("/profile/settings");
      expect(result).toBe(`${env.FRONTEND_URL}/profile/settings`);
    });

    it("should normalize and prepend leading slash if relative path lacks one", () => {
      const result = resolveCallbackURL("orders/recent");
      expect(result).toBe(`${env.FRONTEND_URL}/orders/recent`);
    });
  });
});
