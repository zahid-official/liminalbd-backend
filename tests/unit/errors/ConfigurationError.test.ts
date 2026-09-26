import { describe, expect, it } from "vitest";
import { ConfigurationError } from "../../../src/app/errors/ConfigurationError.js";

describe("ConfigurationError Unit Tests", () => {
  it("should instantiate with correct name, code, message, and stack trace", () => {
    const error = new ConfigurationError("Missing DATABASE_URL");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ConfigurationError);
    expect(error.name).toBe("ConfigurationError");
    expect(error.code).toBe("CONFIGURATION_ERROR");
    expect(error.message).toBe("Missing DATABASE_URL");
    expect(error.stack).toBeDefined();
  });
});
