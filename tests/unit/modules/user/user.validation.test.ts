import { describe, expect, it } from "vitest";
import type { $ZodIssue } from "zod/v4/core";
import { UserValidation } from "../../../../src/app/modules/user/user.validation.js";

const getFirstErrorMessage = (result: {
  success: boolean;
  error?: { issues: $ZodIssue[] };
}): string | undefined => {
  return result.error?.issues[0]?.message;
};

describe("UserValidation Unit Tests", () => {
  describe("updateProfileSchema Validation", () => {
    const bodySchema = UserValidation.updateProfileSchema.body;

    it("should successfully parse and sanitize full valid update payload", () => {
      const payload = {
        name: "  Zahidul Islam  ",
        contactNumber: "  01969658962  ",
        address: "  Gulshan 2, Dhaka, Bangladesh  ",
        image: "  https://example.com/avatar.jpg  ",
      };

      const result = bodySchema.safeParse(payload);

      expect(result).toEqual({
        success: true,
        data: {
          name: "Zahidul Islam",
          contactNumber: "01969658962",
          address: "Gulshan 2, Dhaka, Bangladesh",
          image: "https://example.com/avatar.jpg",
        },
      });
    });

    it("should successfully parse valid partial update payload with single field", () => {
      const result = bodySchema.safeParse({ name: "Updated Name" });

      expect(result).toEqual({
        success: true,
        data: { name: "Updated Name" },
      });
    });

    it("should fail when empty object is submitted with refinement message", () => {
      expect(getFirstErrorMessage(bodySchema.safeParse({}))).toBe(
        "At least one field must be provided for update",
      );
    });

    it("should fail when all fields are undefined with refinement message", () => {
      expect(
        getFirstErrorMessage(
          bodySchema.safeParse({
            name: undefined,
            contactNumber: undefined,
            address: undefined,
            image: undefined,
          }),
        ),
      ).toBe("At least one field must be provided for update");
    });

    describe("Name field constraints", () => {
      it("should reject name shorter than 2 characters", () => {
        expect(
          getFirstErrorMessage(bodySchema.safeParse({ name: "A" })),
        ).toBe("Name must be at least 2 characters");
      });

      it("should reject name exceeding 100 characters", () => {
        expect(
          getFirstErrorMessage(
            bodySchema.safeParse({ name: "A".repeat(101) }),
          ),
        ).toBe("Name cannot exceed 100 characters");
      });

      it("should reject non-string name", () => {
        expect(
          getFirstErrorMessage(bodySchema.safeParse({ name: 12345 })),
        ).toBe("Name must be a valid text string");
      });
    });

    describe("ContactNumber field constraints", () => {
      it("should accept valid 11-digit Bangladeshi mobile number", () => {
        const result = bodySchema.safeParse({
          contactNumber: "01712345678",
        });

        expect(result.success).toBe(true);
      });

      it("should accept valid 14-character Bangladeshi number with +88 prefix", () => {
        const result = bodySchema.safeParse({
          contactNumber: "+8801912345678",
        });

        expect(result.success).toBe(true);
      });

      it("should reject invalid phone format", () => {
        expect(
          getFirstErrorMessage(
            bodySchema.safeParse({ contactNumber: "01234567890" }),
          ),
        ).toBe(
          "Please provide a valid phone number (e.g. 01XXXXXXXXX or +8801XXXXXXXXX)",
        );
      });
    });

    describe("Address field constraints", () => {
      it("should reject address shorter than 3 characters", () => {
        expect(
          getFirstErrorMessage(bodySchema.safeParse({ address: "Dh" })),
        ).toBe("Address must be at least 3 characters");
      });

      it("should reject address exceeding 500 characters", () => {
        expect(
          getFirstErrorMessage(
            bodySchema.safeParse({ address: "A".repeat(501) }),
          ),
        ).toBe("Address cannot exceed 500 characters");
      });

      it("should reject non-string address", () => {
        expect(
          getFirstErrorMessage(bodySchema.safeParse({ address: 99999 })),
        ).toBe("Address must be a valid text string");
      });
    });

    describe("Image field constraints", () => {
      it("should accept valid avatar URL", () => {
        const result = bodySchema.safeParse({
          image: "https://example.com/avatar.png",
        });

        expect(result.success).toBe(true);
      });

      it("should reject invalid URL format", () => {
        expect(
          getFirstErrorMessage(
            bodySchema.safeParse({ image: "not-a-valid-url" }),
          ),
        ).toBe("Avatar image must be a valid URL");
      });

      it("should reject non-string image", () => {
        expect(
          getFirstErrorMessage(bodySchema.safeParse({ image: 12345 })),
        ).toBe("Avatar image must be a valid text string");
      });
    });
  });
});
