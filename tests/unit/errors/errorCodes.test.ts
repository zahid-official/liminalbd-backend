import { describe, expect, it } from "vitest";
import { PUBLIC_ERROR_CODES } from "../../../src/app/errors/errorCodes.js";

describe("PUBLIC_ERROR_CODES Unit Tests", () => {
  it("should have matching key-value pairs across all public error codes", () => {
    Object.entries(PUBLIC_ERROR_CODES).forEach(([key, value]) => {
      expect(value).toBe(key);
    });
  });
});
