import { describe, expect, it } from "vitest";
import { CustomerValidation } from "../../../../src/app/modules/customer/customer.validation.js";

type SafeParseLike =
  | { success: true }
  | { success: false; error: { issues: { message: string }[] } };

const getFirstErrorMessage = (result: SafeParseLike): string | undefined => {
  if (result.success) {
    throw new Error("Expected validation to fail, but it succeeded.");
  }
  return result.error.issues[0]?.message;
};

describe("CustomerValidation Unit Tests", () => {
  const schema = CustomerValidation.registerCustomerSchema.body;

  describe("Successful Validation & Sanitization", () => {
    it("should successfully parse and normalize valid registration payload", () => {
      const payload = {
        name: "  Zahidul Islam  ",
        email: "  Zahid+Studio@LiminalBD.COM  ",
        password: "SecurePass123!",
      };

      const result = schema.safeParse(payload);

      expect(result).toEqual({
        success: true,
        data: {
          name: "Zahidul Islam",
          email: "zahid+studio@liminalbd.com",
          password: "SecurePass123!",
        },
      });
    });

    it("should strip client-injected privileged fields (role, status, admin flags) to prevent privilege escalation", () => {
      const payloadWithInjectedRoles = {
        name: "Malicious User",
        email: "attacker@example.com",
        password: "SecurePass123!",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        isSuperAdmin: true,
        deletedAt: null,
      };

      expect(schema.safeParse(payloadWithInjectedRoles)).toEqual({
        success: true,
        data: {
          name: "Malicious User",
          email: "attacker@example.com",
          password: "SecurePass123!",
        },
      });
    });
  });

  describe("name Field Validation", () => {
    it("should fail when name is undefined with custom required message", () => {
      const payload = {
        email: "user@example.com",
        password: "SecurePass123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Full name is required",
      );
    });

    it("should fail when name is not a string with custom type message", () => {
      const payload = {
        name: 12345,
        email: "user@example.com",
        password: "SecurePass123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Name must be a valid text string",
      );
    });

    it("should fail when name is an empty string with min length message", () => {
      const payload = {
        name: "",
        email: "user@example.com",
        password: "SecurePass123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Name must be at least 2 characters",
      );
    });

    it("should fail when name is whitespace-only with min length message after trimming", () => {
      const payload = {
        name: "     ",
        email: "user@example.com",
        password: "SecurePass123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Name must be at least 2 characters",
      );
    });

    it("should fail when name has fewer than 2 characters after trimming", () => {
      const payload = {
        name: "  A  ",
        email: "user@example.com",
        password: "SecurePass123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Name must be at least 2 characters",
      );
    });

    it("should fail when name exceeds 100 characters", () => {
      const payload = {
        name: "a".repeat(101),
        email: "user@example.com",
        password: "SecurePass123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Name cannot exceed 100 characters",
      );
    });
  });

  describe("Integration of email and password Schemas", () => {
    it("should fail when email is invalid in registration payload", () => {
      const payload = {
        name: "Valid User",
        email: "invalid-email-format",
        password: "SecurePass123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Please provide a valid email address",
      );
    });

    it("should fail when password does not meet complexity requirements", () => {
      const payload = {
        name: "Valid User",
        email: "valid@example.com",
        password: "simplepassword",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Password must include at least one uppercase letter (A-Z)",
      );
    });
  });

  describe("getCustomerSchema Validation", () => {
  const paramsSchema = CustomerValidation.getCustomerSchema.params;
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

    it("should successfully parse valid UUID parameter", () => {
      const result = paramsSchema.safeParse({ id: validUuid });

      expect(result).toEqual({
        success: true,
        data: { id: validUuid },
      });
    });

    it("should trim whitespace around valid UUID parameter", () => {
      const result = paramsSchema.safeParse({ id: `  ${validUuid}  ` });

      expect(result).toEqual({
        success: true,
        data: { id: validUuid },
      });
    });

    it("should fail when id is undefined with required message", () => {
      expect(getFirstErrorMessage(paramsSchema.safeParse({}))).toBe(
        "ID is required",
      );
    });

    it("should fail when id is not a string with custom text string message", () => {
      expect(getFirstErrorMessage(paramsSchema.safeParse({ id: 12345 }))).toBe(
        "ID must be a valid text string",
      );
    });

    it("should fail when id is not a valid UUID format", () => {
      expect(
        getFirstErrorMessage(
          paramsSchema.safeParse({ id: "invalid-uuid-123" }),
        ),
      ).toBe("Invalid ID format");
    });
  });
});
