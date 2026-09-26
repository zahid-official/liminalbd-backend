import status from "http-status";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../../../src/app/config/auth.js";
import { prisma } from "../../../../src/app/config/prisma.js";
import { PUBLIC_ERROR_CODES } from "../../../../src/app/errors/errorCodes.js";
import { CustomerService } from "../../../../src/app/modules/customer/customer.service.js";
import { AuditService } from "../../../../src/app/shared/audit/audit.service.js";
import {
  AuditAction,
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
          CustomerService.registerCustomer({ payload, headers: mockHeaders }),
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
          CustomerService.registerCustomer({ payload, headers: mockHeaders }),
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

        const result = await CustomerService.registerCustomer({
          payload,
          headers: mockHeaders,
        });

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

  describe("getCustomerById", () => {
    const customerId = "cust-user-100";
    const userCreatedAt = new Date("2026-09-20T10:00:00.000Z");
    const userUpdatedAt = new Date("2026-09-21T12:00:00.000Z");
    const customerUpdatedAt = new Date("2026-09-23T15:00:00.000Z");

    const mockCustomerUser = {
      id: customerId,
      name: "Zahidul Islam",
      email: "zahid@liminalbd.com",
      emailVerified: true,
      image: "https://avatar.example.com/user.jpg",
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      createdAt: userCreatedAt,
      updatedAt: userUpdatedAt,
      customer: {
        contactNumber: "+8801700000000",
        address: "Banani, Dhaka",
        updatedAt: customerUpdatedAt,
      },
    };

    it("should throw 404 USER_NOT_FOUND when user does not exist", async () => {
      const findUniqueSpy = vi
        .spyOn(prisma.user, "findUnique")
        .mockResolvedValue(null);

      await expect(
        CustomerService.getCustomerById("non-existent-id"),
      ).rejects.toMatchObject({
        statusCode: status.NOT_FOUND,
        code: PUBLIC_ERROR_CODES.USER_NOT_FOUND,
        message: "Customer not found",
      });

      expect(findUniqueSpy).toHaveBeenCalledWith({
        where: { id: "non-existent-id" },
        include: { customer: true },
      });
    });

    it("should throw 404 USER_NOT_FOUND when user exists but role is not CUSTOMER", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        ...mockCustomerUser,
        role: UserRole.ADMIN,
      } as any);

      await expect(
        CustomerService.getCustomerById(customerId),
      ).rejects.toMatchObject({
        statusCode: status.NOT_FOUND,
        code: PUBLIC_ERROR_CODES.USER_NOT_FOUND,
        message: "Customer not found",
      });
    });

    it("should throw 404 USER_NOT_FOUND when customer user is soft-deleted", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        ...mockCustomerUser,
        deletedAt: new Date("2026-09-25T10:00:00.000Z"),
      } as any);

      await expect(
        CustomerService.getCustomerById(customerId),
      ).rejects.toMatchObject({
        statusCode: status.NOT_FOUND,
        code: PUBLIC_ERROR_CODES.USER_NOT_FOUND,
        message: "Customer not found",
      });
    });

    it("should return customer details with customer.updatedAt when customer profile is newer", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(
        mockCustomerUser as any,
      );

      const result = await CustomerService.getCustomerById(customerId);

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
        updatedAt: customerUpdatedAt,
      });
    });

    it("should return user.updatedAt when user record is more recent than customer profile", async () => {
      const olderCustomerDate = new Date("2026-09-18T10:00:00.000Z");
      const newerUserDate = new Date("2026-09-24T18:00:00.000Z");

      const userWithNewerUpdate = {
        ...mockCustomerUser,
        updatedAt: newerUserDate,
        customer: {
          ...mockCustomerUser.customer,
          updatedAt: olderCustomerDate,
        },
      };

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(
        userWithNewerUpdate as any,
      );

      const result = await CustomerService.getCustomerById(customerId);

      expect(result.updatedAt).toEqual(newerUserDate);
    });

    it("should handle null customer relation gracefully with user.updatedAt", async () => {
      const userWithoutCustomer = {
        ...mockCustomerUser,
        customer: null,
      };

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(
        userWithoutCustomer as any,
      );

      const result = await CustomerService.getCustomerById(customerId);

      expect(result.contactNumber).toBeUndefined();
      expect(result.address).toBeUndefined();
      expect(result.updatedAt).toEqual(userUpdatedAt);
    });
  });

  describe("getCustomers", () => {
    const actorId = "admin-user-001";
    const userCreatedAt = new Date("2026-09-20T10:00:00.000Z");
    const userUpdatedAt = new Date("2026-09-21T12:00:00.000Z");
    const customerUpdatedAt = new Date("2026-09-23T15:00:00.000Z");

    const mockCustomerDbRecord = {
      id: "cust-001",
      name: "Customer One",
      email: "customer1@example.com",
      emailVerified: true,
      image: "https://avatar.example.com/c1.jpg",
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      createdAt: userCreatedAt,
      updatedAt: userUpdatedAt,
      customer: {
        contactNumber: "+8801711111111",
        address: "Gulshan, Dhaka",
        updatedAt: customerUpdatedAt,
      },
    };

    const expectedCustomerItem = {
      id: "cust-001",
      name: "Customer One",
      email: "customer1@example.com",
      emailVerified: true,
      image: "https://avatar.example.com/c1.jpg",
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      contactNumber: "+8801711111111",
      address: "Gulshan, Dhaka",
      createdAt: userCreatedAt,
      updatedAt: customerUpdatedAt,
    };

    describe("Authorization & Defense-in-Depth Security", () => {
      it("should reject CUSTOMER role with 403 FORBIDDEN_ROLE_ACCESS and record audit log", async () => {
        const auditSpy = vi
          .spyOn(AuditService, "record")
          .mockResolvedValue({} as any);

        await expect(
          CustomerService.getCustomers({
            actorId: "customer-actor-1",
            actorRole: UserRole.CUSTOMER,
            query: { page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" },
          }),
        ).rejects.toMatchObject({
          statusCode: status.FORBIDDEN,
          code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          message: "Only administrators can list Customer accounts",
        });

        expect(auditSpy).toHaveBeenCalledTimes(1);
        expect(auditSpy).toHaveBeenCalledWith({
          actorId: "customer-actor-1",
          action: AuditAction.UNAUTHORIZED_ATTEMPT,
          entityType: AuditEntityType.CUSTOMER,
          metadata: {
            attemptedAction: "GET_CUSTOMERS",
            attemptedRole: UserRole.CUSTOMER,
            reason: "FORBIDDEN_ROLE_ACCESS",
          },
        });
      });

      it("should permit ADMIN role to list customers", async () => {
        vi.spyOn(prisma.user, "findMany").mockResolvedValue([mockCustomerDbRecord as any]);
        vi.spyOn(prisma.user, "count").mockResolvedValue(1);

        const result = await CustomerService.getCustomers({
          actorId,
          actorRole: UserRole.ADMIN,
          query: { page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" },
        });

        expect(result.data).toEqual([expectedCustomerItem]);
        expect(result.meta).toEqual({
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        });
      });

      it("should permit SUPER_ADMIN role to list customers", async () => {
        vi.spyOn(prisma.user, "findMany").mockResolvedValue([mockCustomerDbRecord as any]);
        vi.spyOn(prisma.user, "count").mockResolvedValue(1);

        const result = await CustomerService.getCustomers({
          actorId: "super-admin-001",
          actorRole: UserRole.SUPER_ADMIN,
          query: { page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" },
        });

        expect(result.data).toEqual([expectedCustomerItem]);
      });
    });

    describe("Query Filtering, Search & Pagination", () => {
      it("should build default query filtering role CUSTOMER and deletedAt null", async () => {
        const findManySpy = vi
          .spyOn(prisma.user, "findMany")
          .mockResolvedValue([mockCustomerDbRecord as any]);
        const countSpy = vi.spyOn(prisma.user, "count").mockResolvedValue(1);

        const result = await CustomerService.getCustomers({
          actorId,
          actorRole: UserRole.ADMIN,
          query: { page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" },
        });

        expect(findManySpy).toHaveBeenCalledWith({
          where: {
            role: UserRole.CUSTOMER,
            deletedAt: null,
          },
          skip: 0,
          take: 10,
          orderBy: { createdAt: "desc" },
          include: { customer: true },
        });

        expect(countSpy).toHaveBeenCalledWith({
          where: {
            role: UserRole.CUSTOMER,
            deletedAt: null,
          },
        });

        expect(result.meta).toEqual({
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        });
      });

      it("should filter by status when status filter is provided", async () => {
        const findManySpy = vi
          .spyOn(prisma.user, "findMany")
          .mockResolvedValue([]);
        const countSpy = vi.spyOn(prisma.user, "count").mockResolvedValue(0);

        const result = await CustomerService.getCustomers({
          actorId,
          actorRole: UserRole.ADMIN,
          query: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
            status: UserStatus.SUSPENDED,
          },
        });

        expect(findManySpy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              role: UserRole.CUSTOMER,
              deletedAt: null,
              status: UserStatus.SUSPENDED,
            },
          }),
        );
        expect(countSpy).toHaveBeenCalledWith({
          where: {
            role: UserRole.CUSTOMER,
            deletedAt: null,
            status: UserStatus.SUSPENDED,
          },
        });
        expect(result.data).toEqual([]);
        expect(result.meta.total).toBe(0);
      });

      it("should apply multi-field text search when searchTerm is provided", async () => {
        const findManySpy = vi
          .spyOn(prisma.user, "findMany")
          .mockResolvedValue([mockCustomerDbRecord as any]);
        vi.spyOn(prisma.user, "count").mockResolvedValue(1);

        await CustomerService.getCustomers({
          actorId,
          actorRole: UserRole.ADMIN,
          query: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
            searchTerm: "customer",
          },
        });

        expect(findManySpy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              role: UserRole.CUSTOMER,
              deletedAt: null,
              OR: [
                { name: { contains: "customer", mode: "insensitive" } },
                { email: { contains: "customer", mode: "insensitive" } },
              ],
            },
          }),
        );
      });

      it("should filter by creation date range when startDate and endDate are provided", async () => {
        const startDate = new Date("2026-01-01T00:00:00.000Z");
        const endDate = new Date("2026-01-31T23:59:59.999Z");

        const findManySpy = vi
          .spyOn(prisma.user, "findMany")
          .mockResolvedValue([]);
        vi.spyOn(prisma.user, "count").mockResolvedValue(0);

        await CustomerService.getCustomers({
          actorId,
          actorRole: UserRole.ADMIN,
          query: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
            startDate,
            endDate,
          },
        });

        expect(findManySpy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              role: UserRole.CUSTOMER,
              deletedAt: null,
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          }),
        );
      });

      it("should filter by only startDate when endDate is not provided", async () => {
        const startDate = new Date("2026-01-01T00:00:00.000Z");

        const findManySpy = vi
          .spyOn(prisma.user, "findMany")
          .mockResolvedValue([]);
        vi.spyOn(prisma.user, "count").mockResolvedValue(0);

        await CustomerService.getCustomers({
          actorId,
          actorRole: UserRole.ADMIN,
          query: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
            startDate,
          },
        });

        expect(findManySpy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              role: UserRole.CUSTOMER,
              deletedAt: null,
              createdAt: {
                gte: startDate,
              },
            },
          }),
        );
      });

      it("should filter by only endDate when startDate is not provided", async () => {
        const endDate = new Date("2026-01-31T23:59:59.999Z");

        const findManySpy = vi
          .spyOn(prisma.user, "findMany")
          .mockResolvedValue([]);
        vi.spyOn(prisma.user, "count").mockResolvedValue(0);

        await CustomerService.getCustomers({
          actorId,
          actorRole: UserRole.ADMIN,
          query: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
            endDate,
          },
        });

        expect(findManySpy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              role: UserRole.CUSTOMER,
              deletedAt: null,
              createdAt: {
                lte: endDate,
              },
            },
          }),
        );
      });

      it("should apply custom pagination and sorting options correctly", async () => {
        const findManySpy = vi
          .spyOn(prisma.user, "findMany")
          .mockResolvedValue([]);
        vi.spyOn(prisma.user, "count").mockResolvedValue(25);

        const result = await CustomerService.getCustomers({
          actorId,
          actorRole: UserRole.ADMIN,
          query: {
            page: 3,
            limit: 5,
            sortBy: "name",
            sortOrder: "asc",
          },
        });

        expect(findManySpy).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 10,
            take: 5,
            orderBy: { name: "asc" },
          }),
        );
        expect(result.meta).toEqual({
          page: 3,
          limit: 5,
          total: 25,
          totalPages: 5,
        });
      });
    });

    describe("DTO Transformation & DEC-028 Timestamp Resolution", () => {
      it("should resolve user.updatedAt when user is more recent than customer profile", async () => {
        const olderCustomerDate = new Date("2026-09-15T10:00:00.000Z");
        const newerUserDate = new Date("2026-09-25T18:00:00.000Z");

        const record = {
          ...mockCustomerDbRecord,
          updatedAt: newerUserDate,
          customer: {
            ...mockCustomerDbRecord.customer,
            updatedAt: olderCustomerDate,
          },
        };

        vi.spyOn(prisma.user, "findMany").mockResolvedValue([record as any]);
        vi.spyOn(prisma.user, "count").mockResolvedValue(1);

        const result = await CustomerService.getCustomers({
          actorId,
          actorRole: UserRole.ADMIN,
          query: { page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" },
        });

        expect(result.data[0]?.updatedAt).toEqual(newerUserDate);
      });

      it("should handle customer without profile extension gracefully", async () => {
        const recordWithoutProfile = {
          ...mockCustomerDbRecord,
          customer: null,
        };

        vi.spyOn(prisma.user, "findMany").mockResolvedValue([recordWithoutProfile as any]);
        vi.spyOn(prisma.user, "count").mockResolvedValue(1);

        const result = await CustomerService.getCustomers({
          actorId,
          actorRole: UserRole.ADMIN,
          query: { page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" },
        });

        expect(result.data[0]?.contactNumber).toBeUndefined();
        expect(result.data[0]?.address).toBeUndefined();
        expect(result.data[0]?.updatedAt).toEqual(userUpdatedAt);
      });
    });
  });
});

