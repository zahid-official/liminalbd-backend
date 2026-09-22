import { describe, expect, it } from "vitest";
import { AdminValidation } from "../../../../src/app/modules/admin/admin.validation.js";

type SafeParseLike =
  | { success: true }
  | { success: false; error: { issues: { message: string }[] } };

const getFirstErrorMessage = (result: SafeParseLike): string | undefined => {
  if (result.success) {
    throw new Error("Expected validation to fail, but it succeeded.");
  }
  return result.error.issues[0]?.message;
};

describe("AdminValidation Unit Tests", () => {
  const schema = AdminValidation.createAdminSchema.body;

  describe("Successful Validation & Sanitization", () => {
    it("should successfully parse and normalize valid admin creation payload", () => {
      const payload = {
        name: "  Admin Zahid  ",
        email: "  Admin+Test@LiminalBD.COM  ",
        password: "AdminPassword123!",
      };

      const result = schema.safeParse(payload);

      expect(result).toEqual({
        success: true,
        data: {
          name: "Admin Zahid",
          email: "admin+test@liminalbd.com",
          password: "AdminPassword123!",
        },
      });
    });

    it("should strip client-injected privileged fields (role, status, needPasswordChange) to prevent privilege escalation", () => {
      const payloadWithInjectedRoles = {
        name: "New Admin",
        email: "newadmin@example.com",
        password: "AdminPassword123!",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        needPasswordChange: false,
        isSuperAdmin: true,
        deletedAt: null,
      };

      expect(schema.safeParse(payloadWithInjectedRoles)).toEqual({
        success: true,
        data: {
          name: "New Admin",
          email: "newadmin@example.com",
          password: "AdminPassword123!",
        },
      });
    });
  });

  describe("name Field Validation", () => {
    it("should fail when name is undefined with custom required message", () => {
      const payload = {
        email: "admin@example.com",
        password: "AdminPassword123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Full name is required",
      );
    });

    it("should fail when name is not a string with custom type message", () => {
      const payload = {
        name: 12345,
        email: "admin@example.com",
        password: "AdminPassword123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Name must be a valid text string",
      );
    });

    it("should fail when name is an empty string with min length message", () => {
      const payload = {
        name: "",
        email: "admin@example.com",
        password: "AdminPassword123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Name must be at least 2 characters",
      );
    });

    it("should fail when name is whitespace-only with min length message after trimming", () => {
      const payload = {
        name: "     ",
        email: "admin@example.com",
        password: "AdminPassword123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Name must be at least 2 characters",
      );
    });

    it("should fail when name has fewer than 2 characters after trimming", () => {
      const payload = {
        name: "  A  ",
        email: "admin@example.com",
        password: "AdminPassword123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Name must be at least 2 characters",
      );
    });

    it("should fail when name exceeds 100 characters", () => {
      const payload = {
        name: "a".repeat(101),
        email: "admin@example.com",
        password: "AdminPassword123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Name cannot exceed 100 characters",
      );
    });
  });

  describe("Integration of email and password Schemas", () => {
    it("should fail when email is invalid in admin creation payload", () => {
      const payload = {
        name: "Admin User",
        email: "invalid-email-format",
        password: "AdminPassword123!",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Please provide a valid email address",
      );
    });

    it("should fail when password does not meet complexity requirements", () => {
      const payload = {
        name: "Admin User",
        email: "admin@example.com",
        password: "simplepassword",
      };

      expect(getFirstErrorMessage(schema.safeParse(payload))).toBe(
        "Password must include at least one uppercase letter (A-Z)",
      );
    });
  });
});
