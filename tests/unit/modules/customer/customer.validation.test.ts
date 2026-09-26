import { describe, expect, it } from "vitest";
import { CUSTOMER_SORT_FIELDS } from "../../../../src/app/modules/customer/customer.constant.js";
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

  describe("getCustomersQuerySchema Validation", () => {
    const querySchema = CustomerValidation.getCustomersQuerySchema.query;

    describe("Default Values & Normalization", () => {
      it("should apply default values when query object is empty", () => {
        const result = querySchema.safeParse({});

        expect(result).toEqual({
          success: true,
          data: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
          },
        });
      });

      it("should coerce string numbers and sanitize query attributes correctly", () => {
        const query = {
          page: "2",
          limit: "25",
          sortBy: "email",
          sortOrder: "asc",
          searchTerm: "  Zahid Customer  ",
          status: "ACTIVE",
          startDate: "2026-01-01T00:00:00.000Z",
          endDate: "2026-01-31T23:59:59.999Z",
        };

        const result = querySchema.safeParse(query);

        expect(result).toEqual({
          success: true,
          data: {
            page: 2,
            limit: 25,
            sortBy: "email",
            sortOrder: "asc",
            searchTerm: "Zahid Customer",
            status: "ACTIVE",
            startDate: new Date("2026-01-01T00:00:00.000Z"),
            endDate: new Date("2026-01-31T23:59:59.999Z"),
          },
        });
      });

      it("should permit all allowed CUSTOMER_SORT_FIELDS", () => {
        for (const sortField of CUSTOMER_SORT_FIELDS) {
          const result = querySchema.safeParse({ sortBy: sortField });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.sortBy).toBe(sortField);
          }
        }
      });

      it("should strip client-injected fields to prevent query pollution", () => {
        const queryWithInjectedFields = {
          role: "CUSTOMER",
          deletedAt: null,
          isSuperAdmin: true,
          arbitraryInjection: "malicious",
        };

        const result = querySchema.safeParse(queryWithInjectedFields);

        expect(result).toEqual({
          success: true,
          data: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
          },
        });
      });

      it("should pass when only startDate is provided", () => {
        const result = querySchema.safeParse({
          startDate: "2026-01-01T00:00:00.000Z",
        });

        expect(result).toEqual({
          success: true,
          data: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
            startDate: new Date("2026-01-01T00:00:00.000Z"),
          },
        });
      });

      it("should pass when only endDate is provided", () => {
        const result = querySchema.safeParse({
          endDate: "2026-01-31T23:59:59.999Z",
        });

        expect(result).toEqual({
          success: true,
          data: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
            endDate: new Date("2026-01-31T23:59:59.999Z"),
          },
        });
      });

      it("should pass when startDate equals endDate", () => {
        const dateStr = "2026-01-15T12:00:00.000Z";
        const result = querySchema.safeParse({
          startDate: dateStr,
          endDate: dateStr,
        });

        expect(result.success).toBe(true);
      });
    });

    describe("Validation Failures", () => {
      it("should fail when sortBy is not in CUSTOMER_SORT_FIELDS", () => {
        const result = querySchema.safeParse({ sortBy: "password" });
        expect(getFirstErrorMessage(result)).toBe("Invalid sort field");
      });

      it("should fail when sortOrder is neither asc nor desc", () => {
        const result = querySchema.safeParse({ sortOrder: "ascending" });
        expect(getFirstErrorMessage(result)).toBe(
          "Sort order must be either 'asc' or 'desc'",
        );
      });

      it("should fail when page is less than 1", () => {
        const result = querySchema.safeParse({ page: 0 });
        expect(getFirstErrorMessage(result)).toBe("Page must be at least 1");
      });

      it("should fail when page is a float", () => {
        const result = querySchema.safeParse({ page: 1.5 });
        expect(getFirstErrorMessage(result)).toBe("Page must be an integer");
      });

      it("should fail when limit is less than 1", () => {
        const result = querySchema.safeParse({ limit: 0 });
        expect(getFirstErrorMessage(result)).toBe("Limit must be at least 1");
      });

      it("should fail when limit exceeds 100", () => {
        const result = querySchema.safeParse({ limit: 101 });
        expect(getFirstErrorMessage(result)).toBe("Limit cannot exceed 100");
      });

      it("should fail when status is invalid", () => {
        const result = querySchema.safeParse({ status: "PENDING" });
        expect(getFirstErrorMessage(result)).toBe(
          "Status must be a valid account status",
        );
      });

      it("should fail when startDate is an invalid date string", () => {
        const result = querySchema.safeParse({ startDate: "invalid-date" });
        expect(getFirstErrorMessage(result)).toBe("Invalid start date format");
      });

      it("should fail when endDate is an invalid date string", () => {
        const result = querySchema.safeParse({ endDate: "invalid-date" });
        expect(getFirstErrorMessage(result)).toBe("Invalid end date format");
      });

      it("should fail when startDate is strictly after endDate", () => {
        const result = querySchema.safeParse({
          startDate: "2026-02-01T00:00:00.000Z",
          endDate: "2026-01-01T00:00:00.000Z",
        });

        expect(getFirstErrorMessage(result)).toBe(
          "Start date must be before or equal to end date",
        );
      });
    });
  });
});

