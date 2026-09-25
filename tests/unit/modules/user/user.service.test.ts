import status from "http-status";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole, UserStatus } from "../../../../src/generated/prisma/enums.js";
import { prisma } from "../../../../src/app/config/prisma.js";
import { AppError } from "../../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../../src/app/errors/errorCodes.js";
import { UserService } from "../../../../src/app/modules/user/user.service.js";

describe("UserService Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProfile", () => {
    const customerUserId = "cust-user-123";
    const adminUserId = "admin-user-456";

    it("should retrieve flattened profile for Customer with latest timestamp", async () => {
      const mockUserDate = new Date("2026-09-20T10:00:00.000Z");
      const mockCustomerDate = new Date("2026-09-24T12:00:00.000Z");

      vi.spyOn(prisma.user, "findFirst").mockResolvedValue({
        id: customerUserId,
        name: "Customer Name",
        email: "customer@liminalbd.com",
        emailVerified: true,
        image: "https://example.com/avatar.jpg",
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        createdAt: mockUserDate,
        updatedAt: mockUserDate,
        customer: {
          contactNumber: "01969658962",
          address: "Dhaka, Bangladesh",
          updatedAt: mockCustomerDate,
        },
        admin: null,
      } as unknown as Awaited<ReturnType<typeof prisma.user.findFirst>>);

      const result = await UserService.getProfile(customerUserId);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: customerUserId,
          deletedAt: null,
        },
        include: {
          customer: {
            select: {
              contactNumber: true,
              address: true,
              updatedAt: true,
            },
          },
          admin: {
            select: {
              contactNumber: true,
              address: true,
              updatedAt: true,
            },
          },
        },
      });

      expect(result).toEqual({
        id: customerUserId,
        name: "Customer Name",
        email: "customer@liminalbd.com",
        emailVerified: true,
        image: "https://example.com/avatar.jpg",
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        contactNumber: "01969658962",
        address: "Dhaka, Bangladesh",
        createdAt: mockUserDate,
        updatedAt: mockCustomerDate,
      });
    });

    it("should retrieve flattened profile for Admin with latest timestamp", async () => {
      const mockUserDate = new Date("2026-09-20T10:00:00.000Z");
      const mockAdminDate = new Date("2026-09-25T14:00:00.000Z");

      vi.spyOn(prisma.user, "findFirst").mockResolvedValue({
        id: adminUserId,
        name: "Admin Name",
        email: "admin@liminalbd.com",
        emailVerified: true,
        image: null,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        createdAt: mockUserDate,
        updatedAt: mockUserDate,
        customer: null,
        admin: {
          contactNumber: "01711223344",
          address: "Admin Office, Dhaka",
          updatedAt: mockAdminDate,
        },
      } as unknown as Awaited<ReturnType<typeof prisma.user.findFirst>>);

      const result = await UserService.getProfile(adminUserId);

      expect(result.role).toBe(UserRole.ADMIN);
      expect(result.contactNumber).toBe("01711223344");
      expect(result.address).toBe("Admin Office, Dhaka");
      expect(result.updatedAt).toEqual(mockAdminDate);
    });

    it("should defensively resolve nulls when profile extension has no contact/address", async () => {
      const mockDate = new Date("2026-09-20T10:00:00.000Z");

      vi.spyOn(prisma.user, "findFirst").mockResolvedValue({
        id: customerUserId,
        name: "New Customer",
        email: "new@liminalbd.com",
        emailVerified: false,
        image: null,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        createdAt: mockDate,
        updatedAt: mockDate,
        customer: {
          contactNumber: null,
          address: null,
          updatedAt: mockDate,
        },
        admin: null,
      } as unknown as Awaited<ReturnType<typeof prisma.user.findFirst>>);

      const result = await UserService.getProfile(customerUserId);

      expect(result.contactNumber).toBeNull();
      expect(result.address).toBeNull();
      expect(result.image).toBeNull();
    });

    it("should throw 404 AppError when user not found or soft-deleted", async () => {
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);

      await expect(UserService.getProfile("non-existent")).rejects.toThrow(
        new AppError(
          status.NOT_FOUND,
          PUBLIC_ERROR_CODES.USER_NOT_FOUND,
          "User not found",
        ),
      );
    });
  });

  describe("updateProfile", () => {
    const customerUserId = "cust-user-123";
    const adminUserId = "admin-user-456";

    it("should update user and customer extension when user has CUSTOMER role", async () => {
      const mockUserDate = new Date("2026-09-20T10:00:00.000Z");
      const mockUpdatedDate = new Date("2026-09-25T16:00:00.000Z");

      vi.spyOn(prisma.user, "findFirst").mockResolvedValue({
        id: customerUserId,
        role: UserRole.CUSTOMER,
      } as unknown as Awaited<ReturnType<typeof prisma.user.findFirst>>);

      const updateSpy = vi.spyOn(prisma.user, "update").mockResolvedValue({
        id: customerUserId,
        name: "Updated Customer Name",
        email: "customer@liminalbd.com",
        emailVerified: true,
        image: "https://example.com/new-avatar.png",
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        createdAt: mockUserDate,
        updatedAt: mockUpdatedDate,
        customer: {
          contactNumber: "01969658962",
          address: "Gulshan, Dhaka",
          updatedAt: mockUpdatedDate,
        },
        admin: null,
      } as unknown as Awaited<ReturnType<typeof prisma.user.update>>);

      const result = await UserService.updateProfile(customerUserId, {
        name: "Updated Customer Name",
        image: "https://example.com/new-avatar.png",
        contactNumber: "01969658962",
        address: "Gulshan, Dhaka",
      });

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: customerUserId },
        data: {
          name: "Updated Customer Name",
          image: "https://example.com/new-avatar.png",
          customer: {
            update: {
              contactNumber: "01969658962",
              address: "Gulshan, Dhaka",
            },
          },
        },
        include: {
          customer: {
            select: {
              contactNumber: true,
              address: true,
              updatedAt: true,
            },
          },
          admin: {
            select: {
              contactNumber: true,
              address: true,
              updatedAt: true,
            },
          },
        },
      });

      expect(result.name).toBe("Updated Customer Name");
      expect(result.contactNumber).toBe("01969658962");
      expect(result.address).toBe("Gulshan, Dhaka");
    });

    it("should update user and admin extension when user has ADMIN role", async () => {
      const mockUserDate = new Date("2026-09-20T10:00:00.000Z");
      const mockUpdatedDate = new Date("2026-09-25T16:00:00.000Z");

      vi.spyOn(prisma.user, "findFirst").mockResolvedValue({
        id: adminUserId,
        role: UserRole.ADMIN,
      } as unknown as Awaited<ReturnType<typeof prisma.user.findFirst>>);

      const updateSpy = vi.spyOn(prisma.user, "update").mockResolvedValue({
        id: adminUserId,
        name: "Updated Admin Name",
        email: "admin@liminalbd.com",
        emailVerified: true,
        image: null,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        createdAt: mockUserDate,
        updatedAt: mockUpdatedDate,
        customer: null,
        admin: {
          contactNumber: "01711223344",
          address: "Headquarters, Dhaka",
          updatedAt: mockUpdatedDate,
        },
      } as unknown as Awaited<ReturnType<typeof prisma.user.update>>);

      const result = await UserService.updateProfile(adminUserId, {
        name: "Updated Admin Name",
        contactNumber: "01711223344",
        address: "Headquarters, Dhaka",
      });

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: adminUserId },
        data: {
          name: "Updated Admin Name",
          admin: {
            update: {
              contactNumber: "01711223344",
              address: "Headquarters, Dhaka",
            },
          },
        },
        include: {
          customer: {
            select: {
              contactNumber: true,
              address: true,
              updatedAt: true,
            },
          },
          admin: {
            select: {
              contactNumber: true,
              address: true,
              updatedAt: true,
            },
          },
        },
      });

      expect(result.name).toBe("Updated Admin Name");
      expect(result.contactNumber).toBe("01711223344");
      expect(result.address).toBe("Headquarters, Dhaka");
    });

    it("should throw 404 AppError when updating non-existent user", async () => {
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);

      await expect(
        UserService.updateProfile("non-existent", { name: "New Name" }),
      ).rejects.toThrow(
        new AppError(
          status.NOT_FOUND,
          PUBLIC_ERROR_CODES.USER_NOT_FOUND,
          "User not found",
        ),
      );
    });
  });
});
