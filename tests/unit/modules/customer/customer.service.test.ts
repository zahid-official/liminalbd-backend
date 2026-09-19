import status from "http-status";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../../../src/app/config/auth.js";
import { prisma } from "../../../../src/app/config/prisma.js";
import { PUBLIC_ERROR_CODES } from "../../../../src/app/errors/errorCodes.js";
import { CustomerService } from "../../../../src/app/modules/customer/customer.service.js";
import { UserRole, UserStatus } from "../../../../src/generated/prisma/enums.js";

describe("CustomerService Unit Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("registerCustomer", () => {
    const payload = {
      name: "Zahidul Islam",
      email: "zahid@liminalbd.com",
      password: "SecurePass123!",
    };
    const mockHeaders = new Headers({ "x-forwarded-for": "127.0.0.1" });

    describe("Duplicate Email Prevention", () => {
      it("should throw 409 CONFLICT if user with the same email already exists and enforce minimal projection", async () => {
        const findUniqueSpy = vi
          .spyOn(prisma.user, "findUnique")
          .mockResolvedValue({
            id: "existing-user-123",
          } as any);

        const signUpSpy = vi.spyOn(auth.api, "signUpEmail");
        const otpSpy = vi.spyOn(auth.api, "sendVerificationOTP");

        await expect(
          CustomerService.registerCustomer(payload, mockHeaders),
        ).rejects.toMatchObject({
          statusCode: status.CONFLICT,
          code: PUBLIC_ERROR_CODES.USER_ALREADY_EXISTS,
          message: "User with this email already exists",
        });

        expect(findUniqueSpy).toHaveBeenCalledTimes(1);
        expect(findUniqueSpy).toHaveBeenCalledWith({
          where: { email: payload.email },
          select: { id: true },
        });
        expect(signUpSpy).not.toHaveBeenCalled();
        expect(otpSpy).not.toHaveBeenCalled();
      });
    });

    describe("Better Auth Registration Failures", () => {
      it("should throw 500 INTERNAL_SERVER_ERROR if auth.api.signUpEmail returns null or no user", async () => {
        const findUniqueSpy = vi
          .spyOn(prisma.user, "findUnique")
          .mockResolvedValue(null);
        vi.spyOn(auth.api, "signUpEmail").mockResolvedValue(null as any);
        const otpSpy = vi.spyOn(auth.api, "sendVerificationOTP");

        await expect(
          CustomerService.registerCustomer(payload, mockHeaders),
        ).rejects.toMatchObject({
          statusCode: status.INTERNAL_SERVER_ERROR,
          code: PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: "Failed to register user account",
        });

        expect(findUniqueSpy).toHaveBeenCalledTimes(1);
        expect(findUniqueSpy).toHaveBeenCalledWith({
          where: { email: payload.email },
          select: { id: true },
        });
        expect(otpSpy).not.toHaveBeenCalled();
      });
    });

    describe("Successful Registration Flow", () => {
      it("should successfully register customer, dispatch OTP, and return sanitized user identity", async () => {
        const createdAt = new Date("2026-09-19T12:00:00.000Z");

        const findUniqueSpy = vi
          .spyOn(prisma.user, "findUnique")
          .mockResolvedValue(null);

        const signUpSpy = vi.spyOn(auth.api, "signUpEmail").mockResolvedValue({
          user: {
            id: "user-new-456",
            name: "Zahidul Islam",
            email: "zahid@liminalbd.com",
            emailVerified: false,
            role: UserRole.CUSTOMER,
            status: UserStatus.ACTIVE,
            createdAt,
          },
        } as any);

        const otpSpy = vi
          .spyOn(auth.api, "sendVerificationOTP")
          .mockResolvedValue({} as any);

        const result = await CustomerService.registerCustomer(
          payload,
          mockHeaders,
        );

        expect(findUniqueSpy).toHaveBeenCalledTimes(1);
        expect(findUniqueSpy).toHaveBeenCalledWith({
          where: { email: payload.email },
          select: { id: true },
        });

        expect(signUpSpy).toHaveBeenCalledTimes(1);
        expect(signUpSpy).toHaveBeenCalledWith({
          body: {
            name: "Zahidul Islam",
            email: "zahid@liminalbd.com",
            password: "SecurePass123!",
          },
          headers: mockHeaders,
        });

        expect(otpSpy).toHaveBeenCalledTimes(1);
        expect(otpSpy).toHaveBeenCalledWith({
          body: {
            email: "zahid@liminalbd.com",
            type: "email-verification",
          },
          headers: mockHeaders,
        });

        expect(result).toEqual({
          id: "user-new-456",
          name: "Zahidul Islam",
          email: "zahid@liminalbd.com",
          emailVerified: false,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          createdAt,
        });
      });
    });
  });
});
