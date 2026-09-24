import { describe, expect, it } from "vitest";
import {
  emailSchema,
  paginationQuerySchema,
  passwordSchema,
  redirectUrlSchema,
  userStatusSchema,
} from "../../../src/app/validations/common.validation.js";

type SafeParseLike =
  | { success: true }
  | { success: false; error: { issues: { message: string }[] } };

const getFirstErrorMessage = (result: SafeParseLike): string | undefined => {
  if (result.success) {
    throw new Error("Expected validation to fail, but it succeeded.");
  }
  return result.error.issues[0]?.message;
};

describe("common.validation Unit Tests", () => {
  describe("emailSchema", () => {
    it("should successfully parse and normalize valid email address", () => {
      const result = emailSchema.safeParse("  User@Example.COM  ");

      expect(result).toEqual({ success: true, data: "user@example.com" });
    });

    it("should preserve email plus-addressing (subaddressing) while normalizing casing", () => {
      const result = emailSchema.safeParse("  Zahid+Orders@LiminalBD.COM  ");

      expect(result).toEqual({
        success: true,
        data: "zahid+orders@liminalbd.com",
      });
    });

    it("should fail when email is undefined with custom required message", () => {
      expect(getFirstErrorMessage(emailSchema.safeParse(undefined))).toBe(
        "Email address is required",
      );
    });

    it("should fail with format error when email is an empty string", () => {
      expect(getFirstErrorMessage(emailSchema.safeParse(""))).toBe(
        "Please provide a valid email address",
      );
    });

    it("should fail when email is not a string with custom type message", () => {
      expect(getFirstErrorMessage(emailSchema.safeParse(12345))).toBe(
        "Email must be a valid text string",
      );
    });

    it("should fail when email format is invalid", () => {
      expect(
        getFirstErrorMessage(emailSchema.safeParse("not-a-valid-email")),
      ).toBe("Please provide a valid email address");
    });

    it("should fail when email exceeds 255 characters", () => {
      const longLocalPart = "a".repeat(250);

      expect(
        getFirstErrorMessage(
          emailSchema.safeParse(`${longLocalPart}@example.com`),
        ),
      ).toBe("Email address cannot exceed 255 characters");
    });
  });

  describe("passwordSchema", () => {
    it("should successfully validate compliant password", () => {
      const result = passwordSchema.safeParse("SecurePass123!");

      expect(result).toEqual({ success: true, data: "SecurePass123!" });
    });

    it("should fail when password is undefined with custom required message", () => {
      expect(getFirstErrorMessage(passwordSchema.safeParse(undefined))).toBe(
        "Password is required",
      );
    });

    it("should fail with length error when password is an empty string", () => {
      expect(getFirstErrorMessage(passwordSchema.safeParse(""))).toBe(
        "Password must be at least 8 characters",
      );
    });

    it("should fail when password is not a string with custom type message", () => {
      expect(getFirstErrorMessage(passwordSchema.safeParse(987654321))).toBe(
        "Password must be a valid text string",
      );
    });

    it("should fail when password is less than 8 characters", () => {
      expect(getFirstErrorMessage(passwordSchema.safeParse("Sh1!"))).toBe(
        "Password must be at least 8 characters",
      );
    });

    it("should fail when password exceeds 100 characters", () => {
      const longPassword = "A1!" + "a".repeat(100);

      expect(getFirstErrorMessage(passwordSchema.safeParse(longPassword))).toBe(
        "Password cannot exceed 100 characters",
      );
    });

    it("should fail when password lacks an uppercase letter", () => {
      expect(
        getFirstErrorMessage(passwordSchema.safeParse("lowercase123!")),
      ).toBe("Password must include at least one uppercase letter (A-Z)");
    });

    it("should fail when password lacks a lowercase letter", () => {
      expect(
        getFirstErrorMessage(passwordSchema.safeParse("UPPERCASE123!")),
      ).toBe("Password must include at least one lowercase letter (a-z)");
    });

    it("should fail when password lacks a number", () => {
      expect(
        getFirstErrorMessage(
          passwordSchema.safeParse("PasswordWithoutNumber!"),
        ),
      ).toBe("Password must include at least one number (0-9)");
    });

    it("should fail when password lacks a special symbol", () => {
      expect(
        getFirstErrorMessage(
          passwordSchema.safeParse("PasswordWithoutSymbol123"),
        ),
      ).toBe("Password must include at least one symbol (!@#$%^&*)");
    });
  });

  describe("redirectUrlSchema", () => {
    it("should successfully validate and trim valid URL string", () => {
      const result = redirectUrlSchema.safeParse(
        "  https://liminalbd.com/auth  ",
      );

      expect(result).toEqual({
        success: true,
        data: "https://liminalbd.com/auth",
      });
    });

    it("should fail when redirect URL is undefined without optional modifier", () => {
      expect(getFirstErrorMessage(redirectUrlSchema.safeParse(undefined))).toBe(
        "Redirect URL must be a valid text string",
      );
    });

    it("should allow undefined when wrapped with .optional()", () => {
      const result = redirectUrlSchema.optional().safeParse(undefined);

      expect(result).toEqual({ success: true, data: undefined });
    });

    it("should fail when redirect URL is not a string", () => {
      expect(getFirstErrorMessage(redirectUrlSchema.safeParse(4567))).toBe(
        "Redirect URL must be a valid text string",
      );
    });

    it("should fail when redirect URL exceeds 2048 characters", () => {
      const longUrl = "https://example.com/" + "x".repeat(2050);

      expect(getFirstErrorMessage(redirectUrlSchema.safeParse(longUrl))).toBe(
        "Redirect URL cannot exceed 2048 characters",
      );
    });
  });

  describe("paginationQuerySchema", () => {
    it("should provide default values when parsing empty object", () => {
      const result = paginationQuerySchema.safeParse({});

      expect(result).toEqual({
        success: true,
        data: {
          page: 1,
          limit: 10,
          sortOrder: "desc",
        },
      });
    });

    it("should coerce string numbers and sanitize searchTerm correctly", () => {
      const result = paginationQuerySchema.safeParse({
        page: "2",
        limit: "20",
        sortOrder: "asc",
        searchTerm: "  test query  ",
      });

      expect(result).toEqual({
        success: true,
        data: {
          page: 2,
          limit: 20,
          sortOrder: "asc",
          searchTerm: "test query",
        },
      });
    });

    it("should fail when page is less than 1", () => {
      expect(
        getFirstErrorMessage(paginationQuerySchema.safeParse({ page: 0 })),
      ).toBe("Page must be at least 1");
    });

    it("should fail when page is not an integer", () => {
      expect(
        getFirstErrorMessage(paginationQuerySchema.safeParse({ page: 1.5 })),
      ).toBe("Page must be an integer");
    });

    it("should fail when limit exceeds 100", () => {
      expect(
        getFirstErrorMessage(paginationQuerySchema.safeParse({ limit: 150 })),
      ).toBe("Limit cannot exceed 100");
    });

    it("should fail when sortOrder is invalid", () => {
      expect(
        getFirstErrorMessage(
          paginationQuerySchema.safeParse({ sortOrder: "invalid" }),
        ),
      ).toBe("Sort order must be either 'asc' or 'desc'");
    });

    it("should fail when searchTerm exceeds 100 characters", () => {
      expect(
        getFirstErrorMessage(
          paginationQuerySchema.safeParse({ searchTerm: "a".repeat(101) }),
        ),
      ).toBe("Search term cannot exceed 100 characters");
    });
  });

  describe("userStatusSchema", () => {
    it("should accept valid UserStatus enum values", () => {
      const validStatuses = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];

      for (const status of validStatuses) {
        const result = userStatusSchema.safeParse(status);
        expect(result).toEqual({ success: true, data: status });
      }
    });

    it("should fail when status is an invalid value", () => {
      expect(getFirstErrorMessage(userStatusSchema.safeParse("PENDING"))).toBe(
        "Status must be a valid account status",
      );
    });

    it("should fail when status is not a string", () => {
      expect(getFirstErrorMessage(userStatusSchema.safeParse(123))).toBe(
        "Status must be a valid account status",
      );
    });
  });
});
