import { describe, expect, it } from "vitest";
import {
  addressSchema,
  contactNumberSchema,
  emailSchema,
  idSchema,
  nameSchema,
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
  describe("nameSchema", () => {
    it("should successfully parse and trim a valid full name", () => {
      const result = nameSchema.safeParse("  Zahidul Islam  ");

      expect(result).toEqual({ success: true, data: "Zahidul Islam" });
    });

    it("should fail when name is shorter than 2 characters", () => {
      expect(getFirstErrorMessage(nameSchema.safeParse("A"))).toBe(
        "Name must be at least 2 characters",
      );
    });

    it("should fail when name exceeds 100 characters", () => {
      expect(getFirstErrorMessage(nameSchema.safeParse("A".repeat(101)))).toBe(
        "Name cannot exceed 100 characters",
      );
    });

    it("should fail when name is undefined with required message", () => {
      expect(getFirstErrorMessage(nameSchema.safeParse(undefined))).toBe(
        "Full name is required",
      );
    });

    it("should fail when name is not a string", () => {
      expect(getFirstErrorMessage(nameSchema.safeParse(12345))).toBe(
        "Name must be a valid text string",
      );
    });
  });

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

  describe("contactNumberSchema", () => {
    it("should successfully validate and trim valid 11-digit local mobile number", () => {
      const result = contactNumberSchema.safeParse("  01969658962  ");

      expect(result).toEqual({ success: true, data: "01969658962" });
    });

    it("should successfully validate valid E.164 mobile number with +880 country code", () => {
      const result = contactNumberSchema.safeParse("+8801712345678");

      expect(result).toEqual({ success: true, data: "+8801712345678" });
    });

    it("should fail when contact number is undefined with custom required message", () => {
      expect(getFirstErrorMessage(contactNumberSchema.safeParse(undefined))).toBe(
        "Phone number is required",
      );
    });

    it("should fail when contact number is not a string with custom type message", () => {
      expect(getFirstErrorMessage(contactNumberSchema.safeParse(1969658962))).toBe(
        "Phone number must be a valid text string",
      );
    });

    it("should fail when mobile operator digit is invalid (010, 011, 012)", () => {
      expect(getFirstErrorMessage(contactNumberSchema.safeParse("01234567890"))).toBe(
        "Please provide a valid phone number (e.g. 01XXXXXXXXX or +8801XXXXXXXXX)",
      );
    });

    it("should fail when number length is invalid", () => {
      expect(getFirstErrorMessage(contactNumberSchema.safeParse("0196965896"))).toBe(
        "Please provide a valid phone number (e.g. 01XXXXXXXXX or +8801XXXXXXXXX)",
      );
      expect(getFirstErrorMessage(contactNumberSchema.safeParse("019696589623"))).toBe(
        "Please provide a valid phone number (e.g. 01XXXXXXXXX or +8801XXXXXXXXX)",
      );
    });

    it("should fail when missing plus prefix in country code (e.g. 8801...)", () => {
      expect(getFirstErrorMessage(contactNumberSchema.safeParse("8801969658962"))).toBe(
        "Please provide a valid phone number (e.g. 01XXXXXXXXX or +8801XXXXXXXXX)",
      );
    });
  });

  describe("addressSchema", () => {
    it("should successfully parse and trim a valid address", () => {
      const result = addressSchema.safeParse("  Gulshan 2, Dhaka, Bangladesh  ");

      expect(result).toEqual({
        success: true,
        data: "Gulshan 2, Dhaka, Bangladesh",
      });
    });

    it("should fail when address is undefined with custom required message", () => {
      expect(getFirstErrorMessage(addressSchema.safeParse(undefined))).toBe(
        "Address is required",
      );
    });

    it("should fail when address is not a string with custom type message", () => {
      expect(getFirstErrorMessage(addressSchema.safeParse(12345))).toBe(
        "Address must be a valid text string",
      );
    });

    it("should reject address shorter than 3 characters", () => {
      expect(getFirstErrorMessage(addressSchema.safeParse("Dh"))).toBe(
        "Address must be at least 3 characters",
      );
    });

    it("should reject address exceeding 500 characters", () => {
      expect(
        getFirstErrorMessage(addressSchema.safeParse("A".repeat(501))),
      ).toBe("Address cannot exceed 500 characters");
    });
  });

  describe("idSchema", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000";

    it("should successfully parse and trim a valid UUID", () => {
      const result = idSchema.safeParse(`  ${validUuid}  `);

      expect(result).toEqual({
        success: true,
        data: validUuid,
      });
    });

    it("should fail when id is undefined with custom required message", () => {
      expect(getFirstErrorMessage(idSchema.safeParse(undefined))).toBe(
        "ID is required",
      );
    });

    it("should fail when id is not a string with custom type message", () => {
      expect(getFirstErrorMessage(idSchema.safeParse(12345))).toBe(
        "ID must be a valid text string",
      );
    });

    it("should reject invalid UUID format", () => {
      expect(getFirstErrorMessage(idSchema.safeParse("invalid-uuid"))).toBe(
        "Invalid ID format",
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
