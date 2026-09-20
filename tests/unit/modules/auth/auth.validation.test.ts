import { describe, expect, it } from "vitest";
import { AuthValidation } from "../../../../src/app/modules/auth/auth.validation.js";

type SafeParseLike =
  | { success: true }
  | {
      success: false;
      error: { issues: { message: string; path?: readonly PropertyKey[] | PropertyKey[] }[] };
    };

const getFirstErrorMessage = (result: SafeParseLike): string | undefined => {
  if (result.success) {
    throw new Error("Expected validation to fail, but it succeeded.");
  }
  return result.error.issues[0]?.message;
};

const getFirstIssue = (
  result: SafeParseLike,
): { message: string; path?: readonly PropertyKey[] | PropertyKey[] } => {
  if (result.success) {
    throw new Error("Expected validation to fail, but it succeeded.");
  }
  const issue = result.error.issues[0];
  if (!issue) {
    throw new Error("Expected at least one issue, but issues array was empty.");
  }
  return issue;
};

describe("AuthValidation Unit Tests", () => {
  describe("requestEmailVerificationSchema", () => {
    const schema = AuthValidation.requestEmailVerificationSchema.body;

    describe("Successful Validation & Sanitization", () => {
      it("should successfully parse and normalize valid email address", () => {
        const payload = {
          email: "  Zahid+Verify@LiminalBD.COM  ",
        };

        const result = schema.safeParse(payload);

        expect(result).toEqual({
          success: true,
          data: {
            email: "zahid+verify@liminalbd.com",
          },
        });
      });

      it("should strip extraneous or privileged client-injected fields", () => {
        const payload = {
          email: "user@example.com",
          role: "SUPER_ADMIN",
          otp: "123456",
          emailVerified: true,
        };

        expect(schema.safeParse(payload)).toEqual({
          success: true,
          data: {
            email: "user@example.com",
          },
        });
      });
    });

    describe("email Field Validation", () => {
      it("should fail when email is undefined", () => {
        expect(getFirstErrorMessage(schema.safeParse({}))).toBe(
          "Email address is required",
        );
      });

      it("should fail when email is not a string", () => {
        expect(
          getFirstErrorMessage(schema.safeParse({ email: 98765 })),
        ).toBe("Email must be a valid text string");
      });

      it("should fail when email is an empty string", () => {
        expect(
          getFirstErrorMessage(schema.safeParse({ email: "" })),
        ).toBe("Please provide a valid email address");
      });

      it("should fail when email format is invalid", () => {
        expect(
          getFirstErrorMessage(schema.safeParse({ email: "invalid-email" })),
        ).toBe("Please provide a valid email address");
      });
    });
  });

  describe("confirmEmailVerificationSchema", () => {
    const schema = AuthValidation.confirmEmailVerificationSchema.body;

    describe("Successful Validation & Sanitization", () => {
      it("should successfully parse and normalize valid verification payload", () => {
        const payload = {
          email: "  Client@LiminalBD.COM  ",
          otp: "  654321  ",
        };

        const result = schema.safeParse(payload);

        expect(result).toEqual({
          success: true,
          data: {
            email: "client@liminalbd.com",
            otp: "654321",
          },
        });
      });

      it("should strip extraneous client-injected fields", () => {
        const payload = {
          email: "client@liminalbd.com",
          otp: "654321",
          role: "ADMIN",
          status: "ACTIVE",
        };

        expect(schema.safeParse(payload)).toEqual({
          success: true,
          data: {
            email: "client@liminalbd.com",
            otp: "654321",
          },
        });
      });
    });

    describe("email Field Validation", () => {
      it("should fail when email is missing", () => {
        expect(
          getFirstErrorMessage(schema.safeParse({ otp: "123456" })),
        ).toBe("Email address is required");
      });

      it("should fail when email format is invalid", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ email: "not-an-email", otp: "123456" }),
          ),
        ).toBe("Please provide a valid email address");
      });
    });

    describe("otp Field Validation", () => {
      it("should fail when otp is undefined", () => {
        expect(
          getFirstErrorMessage(schema.safeParse({ email: "user@example.com" })),
        ).toBe("OTP code is required");
      });

      it("should fail when otp is not a string", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ email: "user@example.com", otp: 123456 }),
          ),
        ).toBe("OTP code must be a valid string");
      });

      it("should fail when otp is an empty string", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ email: "user@example.com", otp: "" }),
          ),
        ).toBe("Verification code must be exactly 6 digits");
      });

      it("should fail when otp has fewer than 6 digits", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ email: "user@example.com", otp: "12345" }),
          ),
        ).toBe("Verification code must be exactly 6 digits");
      });

      it("should fail when otp has more than 6 digits", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ email: "user@example.com", otp: "1234567" }),
          ),
        ).toBe("Verification code must be exactly 6 digits");
      });

      it("should fail when otp contains non-numeric characters", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ email: "user@example.com", otp: "12345a" }),
          ),
        ).toBe("Verification code must be exactly 6 digits");
      });

      it("should fail when otp contains whitespace between digits", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ email: "user@example.com", otp: "12 345" }),
          ),
        ).toBe("Verification code must be exactly 6 digits");
      });
    });
  });

  describe("loginWithCredentialsSchema", () => {
    const schema = AuthValidation.loginWithCredentialsSchema.body;

    describe("Successful Validation & Sanitization", () => {
      it("should successfully parse valid login credentials", () => {
        const payload = {
          email: "  User@Example.COM  ",
          password: "MyPassword123",
        };

        const result = schema.safeParse(payload);

        expect(result).toEqual({
          success: true,
          data: {
            email: "user@example.com",
            password: "MyPassword123",
          },
        });
      });

      it("should strip extraneous or privileged client-injected fields", () => {
        const payload = {
          email: "user@example.com",
          password: "MyPassword123",
          role: "SUPER_ADMIN",
          isSuperAdmin: true,
        };

        expect(schema.safeParse(payload)).toEqual({
          success: true,
          data: {
            email: "user@example.com",
            password: "MyPassword123",
          },
        });
      });
    });

    describe("email Field Validation", () => {
      it("should fail when email is missing", () => {
        expect(
          getFirstErrorMessage(schema.safeParse({ password: "MyPassword123" })),
        ).toBe("Email address is required");
      });

      it("should fail when email format is invalid", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({
              email: "not-an-email",
              password: "MyPassword123",
            }),
          ),
        ).toBe("Please provide a valid email address");
      });
    });

    describe("password Field Validation", () => {
      it("should fail when password is undefined", () => {
        expect(
          getFirstErrorMessage(schema.safeParse({ email: "user@example.com" })),
        ).toBe("Password is required");
      });

      it("should fail when password is not a string", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ email: "user@example.com", password: 123456 }),
          ),
        ).toBe("Password must be a valid text string");
      });

      it("should fail when password is empty", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ email: "user@example.com", password: "" }),
          ),
        ).toBe("Password cannot be empty");
      });

      it("should fail when password exceeds 100 characters", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({
              email: "user@example.com",
              password: "a".repeat(101),
            }),
          ),
        ).toBe("Password cannot exceed 100 characters");
      });
    });
  });

  describe("loginWithGoogleSchema & linkGoogleSchema", () => {
    const loginSchema = AuthValidation.loginWithGoogleSchema.query;
    const linkSchema = AuthValidation.linkGoogleSchema.query;

    it("should accept valid or omitted redirectTo query parameter", () => {
      expect(loginSchema.safeParse({ redirectTo: "/dashboard" })).toEqual({
        success: true,
        data: { redirectTo: "/dashboard" },
      });

      expect(loginSchema.safeParse({})).toEqual({
        success: true,
        data: {},
      });

      expect(linkSchema.safeParse({ redirectTo: "/settings/security" })).toEqual({
        success: true,
        data: { redirectTo: "/settings/security" },
      });
    });

    it("should reject invalid redirectTo parameter", () => {
      expect(
        getFirstErrorMessage(loginSchema.safeParse({ redirectTo: 12345 })),
      ).toBe("Redirect URL must be a valid text string");

      expect(
        getFirstErrorMessage(
          loginSchema.safeParse({ redirectTo: `/${"a".repeat(2048)}` }),
        ),
      ).toBe("Redirect URL cannot exceed 2048 characters");
    });
  });

  describe("forgotPasswordSchema", () => {
    const schema = AuthValidation.forgotPasswordSchema.body;

    describe("Successful Validation & Sanitization", () => {
      it("should parse valid forgot password payload with or without redirectTo", () => {
        expect(
          schema.safeParse({
            email: "User@Example.COM",
            redirectTo: "https://liminalbd.com/reset",
          }),
        ).toEqual({
          success: true,
          data: {
            email: "user@example.com",
            redirectTo: "https://liminalbd.com/reset",
          },
        });

        expect(schema.safeParse({ email: "user@example.com" })).toEqual({
          success: true,
          data: {
            email: "user@example.com",
          },
        });
      });

      it("should strip extraneous or privileged client-injected fields", () => {
        const payload = {
          email: "user@example.com",
          role: "ADMIN",
        };

        expect(schema.safeParse(payload)).toEqual({
          success: true,
          data: {
            email: "user@example.com",
          },
        });
      });
    });

    describe("email Field Validation", () => {
      it("should fail when email is missing", () => {
        expect(getFirstErrorMessage(schema.safeParse({}))).toBe(
          "Email address is required",
        );
      });

      it("should fail when email format is invalid", () => {
        expect(
          getFirstErrorMessage(schema.safeParse({ email: "invalid-email" })),
        ).toBe("Please provide a valid email address");
      });
    });

    describe("redirectTo Field Validation", () => {
      it("should reject invalid redirectTo parameter", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({
              email: "user@example.com",
              redirectTo: 12345,
            }),
          ),
        ).toBe("Redirect URL must be a valid text string");

        expect(
          getFirstErrorMessage(
            schema.safeParse({
              email: "user@example.com",
              redirectTo: `/${"a".repeat(2048)}`,
            }),
          ),
        ).toBe("Redirect URL cannot exceed 2048 characters");
      });
    });
  });

  describe("resetPasswordSchema", () => {
    const schema = AuthValidation.resetPasswordSchema.body;

    describe("Successful Validation & Sanitization", () => {
      it("should successfully parse valid reset token and compliant new password", () => {
        const result = schema.safeParse({
          token: "  valid-reset-token-xyz  ",
          newPassword: "SecureNewPassword123!",
        });

        expect(result).toEqual({
          success: true,
          data: {
            token: "valid-reset-token-xyz",
            newPassword: "SecureNewPassword123!",
          },
        });
      });

      it("should strip extraneous or privileged client-injected fields", () => {
        const payload = {
          token: "valid-reset-token-xyz",
          newPassword: "SecureNewPassword123!",
          role: "SUPER_ADMIN",
        };

        expect(schema.safeParse(payload)).toEqual({
          success: true,
          data: {
            token: "valid-reset-token-xyz",
            newPassword: "SecureNewPassword123!",
          },
        });
      });
    });

    describe("token Field Validation", () => {
      it("should fail when token is undefined", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ newPassword: "SecurePassword123!" }),
          ),
        ).toBe("Reset token is required");
      });

      it("should fail when token is not a string", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({
              token: 99999,
              newPassword: "SecurePassword123!",
            }),
          ),
        ).toBe("Reset token must be a valid text string");
      });

      it("should fail when token is empty after trimming", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({
              token: "   ",
              newPassword: "SecurePassword123!",
            }),
          ),
        ).toBe("Reset token cannot be empty");
      });

      it("should fail when token exceeds 256 characters", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({
              token: "t".repeat(257),
              newPassword: "SecurePassword123!",
            }),
          ),
        ).toBe("Reset token is invalid");
      });
    });

    describe("newPassword Field Validation", () => {
      it("should fail when newPassword is missing", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ token: "valid-reset-token-xyz" }),
          ),
        ).toBe("Password is required");
      });

      it("should fail when newPassword does not satisfy complexity requirements", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({
              token: "valid-reset-token-xyz",
              newPassword: "weakpassword",
            }),
          ),
        ).toBe("Password must include at least one uppercase letter (A-Z)");
      });
    });
  });

  describe("changePasswordSchema", () => {
    const schema = AuthValidation.changePasswordSchema.body;

    describe("Successful Validation & Defaults", () => {
      it("should parse valid payload and default revokeOtherSessions to true when omitted", () => {
        const result = schema.safeParse({
          currentPassword: "OldPassword123!",
          newPassword: "NewSecurePassword456!",
        });

        expect(result).toEqual({
          success: true,
          data: {
            currentPassword: "OldPassword123!",
            newPassword: "NewSecurePassword456!",
            revokeOtherSessions: true,
          },
        });
      });

      it("should preserve explicit revokeOtherSessions: false", () => {
        const result = schema.safeParse({
          currentPassword: "OldPassword123!",
          newPassword: "NewSecurePassword456!",
          revokeOtherSessions: false,
        });

        expect(result).toEqual({
          success: true,
          data: {
            currentPassword: "OldPassword123!",
            newPassword: "NewSecurePassword456!",
            revokeOtherSessions: false,
          },
        });
      });

      it("should strip extraneous or privileged client-injected fields", () => {
        const payload = {
          currentPassword: "OldPassword123!",
          newPassword: "NewSecurePassword456!",
          role: "SUPER_ADMIN",
          isSuperAdmin: true,
          status: "ACTIVE",
        };

        expect(schema.safeParse(payload)).toEqual({
          success: true,
          data: {
            currentPassword: "OldPassword123!",
            newPassword: "NewSecurePassword456!",
            revokeOtherSessions: true,
          },
        });
      });
    });

    describe("currentPassword Field Validation", () => {
      it("should fail when currentPassword is undefined", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ newPassword: "NewPassword123!" }),
          ),
        ).toBe("Current password is required");
      });

      it("should fail when currentPassword is not a string", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({
              currentPassword: 12345,
              newPassword: "NewPassword123!",
            }),
          ),
        ).toBe("Current password must be a valid text string");
      });

      it("should fail when currentPassword is empty", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({
              currentPassword: "",
              newPassword: "NewPassword123!",
            }),
          ),
        ).toBe("Current password cannot be empty");
      });

      it("should fail when currentPassword exceeds 100 characters", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({
              currentPassword: "p".repeat(101),
              newPassword: "NewPassword123!",
            }),
          ),
        ).toBe("Current password cannot exceed 100 characters");
      });
    });

    describe("newPassword Field Validation", () => {
      it("should fail when newPassword is undefined", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ currentPassword: "OldPassword123!" }),
          ),
        ).toBe("Password is required");
      });

      it("should fail when newPassword does not satisfy password complexity", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({
              currentPassword: "OldPassword123!",
              newPassword: "weakpassword",
            }),
          ),
        ).toBe("Password must include at least one uppercase letter (A-Z)");
      });
    });

    describe("revokeOtherSessions Field Validation", () => {
      it("should fail when revokeOtherSessions is not a boolean", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({
              currentPassword: "OldPassword123!",
              newPassword: "NewPassword123!",
              revokeOtherSessions: "yes",
            }),
          ),
        ).toBe("Revoke other sessions must be a boolean");
      });
    });

    describe("Business Invariant Refinement (.refine)", () => {
      it("should reject payload when newPassword is identical to currentPassword", () => {
        const result = schema.safeParse({
          currentPassword: "SamePassword123!",
          newPassword: "SamePassword123!",
        });

        const issue = getFirstIssue(result);
        expect(issue.message).toBe(
          "New password must be different from current password",
        );
        expect(issue.path).toEqual(["newPassword"]);
      });
    });
  });

  describe("setPasswordSchema", () => {
    const schema = AuthValidation.setPasswordSchema.body;

    describe("Successful Validation & Sanitization", () => {
      it("should successfully parse valid password", () => {
        const result = schema.safeParse({
          newPassword: "NewStrongPassword123!",
        });

        expect(result).toEqual({
          success: true,
          data: {
            newPassword: "NewStrongPassword123!",
          },
        });
      });

      it("should strip extraneous or privileged client-injected fields", () => {
        const payload = {
          newPassword: "NewStrongPassword123!",
          role: "ADMIN",
          status: "SUSPENDED",
        };

        expect(schema.safeParse(payload)).toEqual({
          success: true,
          data: {
            newPassword: "NewStrongPassword123!",
          },
        });
      });
    });

    describe("newPassword Field Validation", () => {
      it("should fail when newPassword is missing", () => {
        expect(getFirstErrorMessage(schema.safeParse({}))).toBe(
          "Password is required",
        );
      });

      it("should fail when newPassword fails passwordSchema validation", () => {
        expect(
          getFirstErrorMessage(
            schema.safeParse({ newPassword: "weakpassword" }),
          ),
        ).toBe("Password must include at least one uppercase letter (A-Z)");
      });
    });
  });
});
