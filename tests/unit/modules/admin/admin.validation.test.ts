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

  describe("updateAdminSchema", () => {
    describe("Params Validation (id)", () => {
      const paramsSchema = AdminValidation.updateAdminSchema.params;

      it("should pass when id is a valid UUID", () => {
        const validId = "c9bf9e57-1685-4c89-bafb-ff5af830be8a";
        const result = paramsSchema.safeParse({ id: validId });

        expect(result).toEqual({
          success: true,
          data: { id: validId },
        });
      });

      it("should trim surrounding whitespace from UUID", () => {
        const validId = "c9bf9e57-1685-4c89-bafb-ff5af830be8a";
        const result = paramsSchema.safeParse({ id: `  ${validId}  ` });

        expect(result).toEqual({
          success: true,
          data: { id: validId },
        });
      });

      it("should fail when id is missing or undefined", () => {
        const result = paramsSchema.safeParse({});

        expect(getFirstErrorMessage(result)).toBe("Admin ID is required");
      });

      it("should fail when id is not a string", () => {
        const result = paramsSchema.safeParse({ id: 12345 });

        expect(getFirstErrorMessage(result)).toBe(
          "Admin ID must be a valid text string",
        );
      });

      it("should fail when id is an invalid UUID format", () => {
        const result = paramsSchema.safeParse({ id: "invalid-uuid-string" });

        expect(getFirstErrorMessage(result)).toBe("Invalid Admin ID format");
      });
    });

    describe("Body Validation (role & status)", () => {
      const bodySchema = AdminValidation.updateAdminSchema.body;

      it("should pass when only role is provided with valid value", () => {
        const result = bodySchema.safeParse({ role: "ADMIN" });

        expect(result).toEqual({
          success: true,
          data: { role: "ADMIN" },
        });

        const superAdminResult = bodySchema.safeParse({ role: "SUPER_ADMIN" });
        expect(superAdminResult).toEqual({
          success: true,
          data: { role: "SUPER_ADMIN" },
        });
      });

      it("should pass when only status is provided with valid value", () => {
        for (const status of ["ACTIVE", "SUSPENDED", "DEACTIVATED"]) {
          const result = bodySchema.safeParse({ status });
          expect(result).toEqual({
            success: true,
            data: { status },
          });
        }
      });

      it("should pass when both valid role and status are provided", () => {
        const result = bodySchema.safeParse({
          role: "SUPER_ADMIN",
          status: "SUSPENDED",
        });

        expect(result).toEqual({
          success: true,
          data: {
            role: "SUPER_ADMIN",
            status: "SUSPENDED",
          },
        });
      });

      it("should strip client-injected fields (e.g. name, email, password, isSuperAdmin)", () => {
        const result = bodySchema.safeParse({
          role: "ADMIN",
          name: "Injected Name",
          email: "injected@example.com",
          password: "InjectedPassword123!",
          isSuperAdmin: true,
        });

        expect(result).toEqual({
          success: true,
          data: { role: "ADMIN" },
        });
      });

      it("should fail when role is CUSTOMER", () => {
        const result = bodySchema.safeParse({ role: "CUSTOMER" });

        expect(getFirstErrorMessage(result)).toBe(
          "Role must be either ADMIN or SUPER_ADMIN",
        );
      });

      it("should fail when role is an unknown string", () => {
        const result = bodySchema.safeParse({ role: "MODERATOR" });

        expect(getFirstErrorMessage(result)).toBe(
          "Role must be either ADMIN or SUPER_ADMIN",
        );
      });

      it("should fail when status is an invalid enum value", () => {
        const result = bodySchema.safeParse({ status: "PENDING" });

        expect(getFirstErrorMessage(result)).toBe(
          "Status must be a valid account status",
        );
      });

      it("should fail when empty object is provided", () => {
        const result = bodySchema.safeParse({});

        expect(getFirstErrorMessage(result)).toBe(
          "At least one field must be provided for update",
        );
      });

      it("should fail when all fields are undefined", () => {
        const result = bodySchema.safeParse({
          role: undefined,
          status: undefined,
        });

        expect(getFirstErrorMessage(result)).toBe(
          "At least one field must be provided for update",
        );
      });
    });
  });

  describe("getAdminsQuerySchema", () => {
    const querySchema = AdminValidation.getAdminsQuerySchema.query;

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
          page: "3",
          limit: "25",
          sortBy: "name",
          sortOrder: "asc",
          searchTerm: "  Zahid Admin  ",
          status: "ACTIVE",
        };

        const result = querySchema.safeParse(query);

        expect(result).toEqual({
          success: true,
          data: {
            page: 3,
            limit: 25,
            sortBy: "name",
            sortOrder: "asc",
            searchTerm: "Zahid Admin",
            status: "ACTIVE",
          },
        });
      });

      it("should strip client-injected fields to prevent query injection", () => {
        const queryWithInjectedFields = {
          role: "ADMIN",
          deletedAt: null,
          isSuperAdmin: true,
          arbitraryFilter: "malicious",
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
    });

    describe("page Field Validation", () => {
      it("should fail when page is 0 with min error message", () => {
        const result = querySchema.safeParse({ page: "0" });

        expect(getFirstErrorMessage(result)).toBe("Page must be at least 1");
      });

      it("should fail when page is negative with min error message", () => {
        const result = querySchema.safeParse({ page: "-5" });

        expect(getFirstErrorMessage(result)).toBe("Page must be at least 1");
      });

      it("should fail when page is a float with integer error message", () => {
        const result = querySchema.safeParse({ page: "1.5" });

        expect(getFirstErrorMessage(result)).toBe("Page must be an integer");
      });

      it("should fail when page is not a valid number", () => {
        const result = querySchema.safeParse({ page: "abc" });

        expect(getFirstErrorMessage(result)).toBe(
          "Page must be a valid number",
        );
      });
    });

    describe("limit Field Validation", () => {
      it("should fail when limit is 0 with min error message", () => {
        const result = querySchema.safeParse({ limit: "0" });

        expect(getFirstErrorMessage(result)).toBe("Limit must be at least 1");
      });

      it("should fail when limit exceeds 100 with max error message", () => {
        const result = querySchema.safeParse({ limit: "101" });

        expect(getFirstErrorMessage(result)).toBe("Limit cannot exceed 100");
      });

      it("should fail when limit is a float with integer error message", () => {
        const result = querySchema.safeParse({ limit: "10.5" });

        expect(getFirstErrorMessage(result)).toBe("Limit must be an integer");
      });

      it("should fail when limit is not a valid number", () => {
        const result = querySchema.safeParse({ limit: "invalid" });

        expect(getFirstErrorMessage(result)).toBe(
          "Limit must be a valid number",
        );
      });
    });

    describe("sortBy & sortOrder Validation", () => {
      it("should accept all allowed sort fields", () => {
        const allowedFields = [
          "createdAt",
          "updatedAt",
          "name",
          "email",
          "status",
        ];

        for (const sortBy of allowedFields) {
          const result = querySchema.safeParse({ sortBy });
          expect(result.success).toBe(true);
        }
      });

      it("should fail when sortBy is an invalid field", () => {
        const result = querySchema.safeParse({ sortBy: "password" });

        expect(getFirstErrorMessage(result)).toBe("Invalid sort field");
      });

      it("should fail when sortOrder is not 'asc' or 'desc'", () => {
        const result = querySchema.safeParse({ sortOrder: "ascending" });

        expect(getFirstErrorMessage(result)).toBe(
          "Sort order must be either 'asc' or 'desc'",
        );
      });
    });

    describe("searchTerm & status Validation", () => {
      it("should accept valid search terms and trim whitespace", () => {
        const result = querySchema.safeParse({
          searchTerm: "  studio admin  ",
        });

        expect(result).toEqual({
          success: true,
          data: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
            searchTerm: "studio admin",
          },
        });
      });

      it("should fail when searchTerm exceeds 100 characters", () => {
        const result = querySchema.safeParse({ searchTerm: "a".repeat(101) });

        expect(getFirstErrorMessage(result)).toBe(
          "Search term cannot exceed 100 characters",
        );
      });

      it("should accept valid user statuses", () => {
        const validStatuses = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];

        for (const status of validStatuses) {
          const result = querySchema.safeParse({ status });
          expect(result.success).toBe(true);
        }
      });

      it("should fail when status is not a valid UserStatus enum value", () => {
        const result = querySchema.safeParse({ status: "PENDING" });

        expect(getFirstErrorMessage(result)).toBe(
          "Status must be a valid account status",
        );
      });
    });
  });
});
