import status from "http-status";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../../../src/app/config/auth.js";
import { prisma } from "../../../../src/app/config/prisma.js";
import { AppError } from "../../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../../src/app/errors/errorCodes.js";
import { CustomerService } from "../../../../src/app/modules/customer/customer.service.js";
import { AuthorizationService } from "../../../../src/app/shared/authorization/authorization.service.js";
import {
  AuditEntityType,
  UserRole,
  UserStatus,
} from "../../../../src/generated/prisma/enums.js";

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

  describe("getCustomerProfile", () => {
    const customerId = "cust-user-100";
    const userCreatedAt = new Date("2026-09-20T10:00:00.000Z");
    const userUpdatedAt = new Date("2026-09-21T12:00:00.000Z");
    const customerUpdatedAt = new Date("2026-09-23T15:00:00.000Z");

    const mockTargetUser = {
      id: customerId,
      name: "Zahidul Islam",
      email: "zahid@liminalbd.com",
      emailVerified: true,
      image: "https://avatar.example.com/user.jpg",
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      createdAt: userCreatedAt,
      updatedAt: userUpdatedAt,
      customer: {
        contactNumber: "+8801700000000",
        address: "Banani, Dhaka",
        updatedAt: customerUpdatedAt,
      },
    };

    it("should throw 404 USER_NOT_FOUND when customer user does not exist or is soft-deleted", async () => {
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);

      await expect(
        CustomerService.getCustomerProfile({
          actorId: customerId,
          actorRole: UserRole.CUSTOMER,
          targetId: "non-existent-id",
        }),
      ).rejects.toMatchObject({
        statusCode: status.NOT_FOUND,
        code: PUBLIC_ERROR_CODES.USER_NOT_FOUND,
        message: "Customer not found",
      });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: "non-existent-id",
          role: UserRole.CUSTOMER,
          deletedAt: null,
        },
        select: expect.any(Object),
      });
    });

    it("should authorize and return flattened profile when Customer accesses their own profile", async () => {
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(
        mockTargetUser as any,
      );
      const authSpy = vi
        .spyOn(AuthorizationService, "authorizeOwnership")
        .mockResolvedValue();

      const result = await CustomerService.getCustomerProfile({
        actorId: customerId,
        actorRole: UserRole.CUSTOMER,
        targetId: customerId,
      });

      expect(authSpy).toHaveBeenCalledWith({
        actorId: customerId,
        actorRole: UserRole.CUSTOMER,
        resourceOwnerId: customerId,
        resourceType: AuditEntityType.CUSTOMER,
        resourceId: customerId,
        action: "GET_CUSTOMER_PROFILE",
        policy: {
          allowAdmin: true,
          allowSuperAdmin: true,
        },
      });

      expect(result).toEqual({
        id: customerId,
        name: "Zahidul Islam",
        email: "zahid@liminalbd.com",
        emailVerified: true,
        image: "https://avatar.example.com/user.jpg",
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        contactNumber: "+8801700000000",
        address: "Banani, Dhaka",
        createdAt: userCreatedAt,
        updatedAt: customerUpdatedAt, // reflects newer customer updatedAt
      });
    });

    it("should allow Admin to view customer profile under authorized policy", async () => {
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(
        mockTargetUser as any,
      );
      const authSpy = vi
        .spyOn(AuthorizationService, "authorizeOwnership")
        .mockResolvedValue();

      const result = await CustomerService.getCustomerProfile({
        actorId: "admin-actor-1",
        actorRole: UserRole.ADMIN,
        targetId: customerId,
      });

      expect(authSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "admin-actor-1",
          actorRole: UserRole.ADMIN,
          policy: { allowAdmin: true, allowSuperAdmin: true },
        }),
      );

      expect(result.id).toBe(customerId);
    });

    it("should allow Super Admin to view customer profile under authorized policy", async () => {
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(
        mockTargetUser as any,
      );
      const authSpy = vi
        .spyOn(AuthorizationService, "authorizeOwnership")
        .mockResolvedValue();

      const result = await CustomerService.getCustomerProfile({
        actorId: "super-admin-1",
        actorRole: UserRole.SUPER_ADMIN,
        targetId: customerId,
      });

      expect(authSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "super-admin-1",
          actorRole: UserRole.SUPER_ADMIN,
        }),
      );

      expect(result.id).toBe(customerId);
    });

    it("should propagate 403 FORBIDDEN_ACCESS when AuthorizationService rejects cross-customer access", async () => {
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(
        mockTargetUser as any,
      );
      vi.spyOn(AuthorizationService, "authorizeOwnership").mockRejectedValue(
        new AppError(
          status.FORBIDDEN,
          PUBLIC_ERROR_CODES.FORBIDDEN_ACCESS,
          "You do not have permission to access or modify this resource",
        ),
      );

      await expect(
        CustomerService.getCustomerProfile({
          actorId: "attacker-customer-2",
          actorRole: UserRole.CUSTOMER,
          targetId: customerId,
        }),
      ).rejects.toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ACCESS,
      });
    });

    it("should return user.updatedAt when user record is more recent than customer profile", async () => {
      const olderCustomerDate = new Date("2026-09-18T10:00:00.000Z");
      const newerUserDate = new Date("2026-09-24T18:00:00.000Z");

      const userWithNewerUpdate = {
        ...mockTargetUser,
        updatedAt: newerUserDate,
        customer: {
          ...mockTargetUser.customer,
          updatedAt: olderCustomerDate,
        },
      };

      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(
        userWithNewerUpdate as any,
      );
      vi.spyOn(AuthorizationService, "authorizeOwnership").mockResolvedValue();

      const result = await CustomerService.getCustomerProfile({
        actorId: customerId,
        actorRole: UserRole.CUSTOMER,
        targetId: customerId,
      });

      expect(result.updatedAt).toEqual(newerUserDate);
    });

    it("should handle null customer relation gracefully with null defaults and user.updatedAt", async () => {
      const userWithoutCustomer = {
        ...mockTargetUser,
        customer: null,
      };

      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(
        userWithoutCustomer as any,
      );
      vi.spyOn(AuthorizationService, "authorizeOwnership").mockResolvedValue();

      const result = await CustomerService.getCustomerProfile({
        actorId: customerId,
        actorRole: UserRole.CUSTOMER,
        targetId: customerId,
      });

      expect(result.contactNumber).toBeNull();
      expect(result.address).toBeNull();
      expect(result.updatedAt).toEqual(userUpdatedAt);
    });
  });
});
