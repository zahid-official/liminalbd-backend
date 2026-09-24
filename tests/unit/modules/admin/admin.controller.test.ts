import type { NextFunction, Request, Response } from "express";
import status from "http-status";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../../src/app/errors/errorCodes.js";
import { AdminController } from "../../../../src/app/modules/admin/admin.controller.js";
import { AdminService } from "../../../../src/app/modules/admin/admin.service.js";
import type { AuthUser } from "../../../../src/app/modules/auth/auth.interface.js";
import { UserRole, UserStatus } from "../../../../src/generated/prisma/enums.js";

interface MockResponseOptions {
  user?: Partial<AuthUser>;
  validatedBody?: unknown;
  validatedParams?: unknown;
  validatedQuery?: unknown;
}

const makeMockRes = ({
  user,
  validatedBody,
  validatedParams,
  validatedQuery,
}: MockResponseOptions = {}) => {
  return {
    locals: {
      user,
      validated: {
        ...(validatedBody !== undefined ? { body: validatedBody } : {}),
        ...(validatedParams !== undefined ? { params: validatedParams } : {}),
        ...(validatedQuery !== undefined ? { query: validatedQuery } : {}),
      },
    },
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
};

describe("AdminController Unit Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createAdmin", () => {
    const mockPayload = {
      name: "New Admin",
      email: "newadmin@liminalbd.com",
      password: "AdminPassword123!",
    };

    const mockAuthUser = {
      id: "super-admin-uuid-1",
      role: UserRole.SUPER_ADMIN,
    } as AuthUser;

    it("should extract validated payload and actor context, invoke AdminService, and return 201 response", async () => {
      const mockResult = {
        id: "admin-uuid-123",
        name: "New Admin",
        email: "newadmin@liminalbd.com",
        emailVerified: true,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        needPasswordChange: true,
        createdAt: new Date("2026-09-23T10:00:00.000Z"),
        updatedAt: new Date("2026-09-23T10:00:00.000Z"),
        admin: {
          contactNumber: null,
          address: null,
          createdAt: new Date("2026-09-23T10:00:00.000Z"),
          updatedAt: new Date("2026-09-23T10:00:00.000Z"),
        },
      };

      const createAdminSpy = vi
        .spyOn(AdminService, "createAdmin")
        .mockResolvedValue(mockResult);

      const req = {} as Request;
      const res = makeMockRes({
        user: mockAuthUser,
        validatedBody: mockPayload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AdminController.createAdmin(req, res, next);

      expect(createAdminSpy).toHaveBeenCalledTimes(1);
      expect(createAdminSpy).toHaveBeenCalledWith({
        actorId: mockAuthUser.id,
        actorRole: UserRole.SUPER_ADMIN,
        payload: mockPayload,
      });

      expect(res.status).toHaveBeenCalledWith(status.CREATED);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Admin account created successfully",
        data: mockResult,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next() middleware via catchAsync", async () => {
      const serviceError = new AppError(
        status.CONFLICT,
        PUBLIC_ERROR_CODES.USER_ALREADY_EXISTS,
        "User with this email already exists",
      );

      vi.spyOn(AdminService, "createAdmin").mockRejectedValue(serviceError);

      const req = {} as Request;
      const res = makeMockRes({
        user: mockAuthUser,
        validatedBody: mockPayload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AdminController.createAdmin(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("updateAdmin", () => {
    const targetId = "target-admin-uuid-1";
    const mockParams = { id: targetId };
    const mockPayload = {
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    };

    const mockAuthUser = {
      id: "super-admin-uuid-1",
      role: UserRole.SUPER_ADMIN,
    } as AuthUser;

    const mockResult = {
      id: targetId,
      name: "Updated Admin",
      email: "updatedadmin@liminalbd.com",
      emailVerified: true,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      needPasswordChange: false,
      createdAt: new Date("2026-09-20T10:00:00.000Z"),
      updatedAt: new Date("2026-09-23T12:00:00.000Z"),
      admin: {
        contactNumber: "01700000000",
        address: "Dhaka, Bangladesh",
        createdAt: new Date("2026-09-20T10:00:00.000Z"),
        updatedAt: new Date("2026-09-20T10:00:00.000Z"),
      },
    };

    it("should extract validated params, payload and actor context, invoke AdminService.updateAdmin, and return 200 response", async () => {
      const updateAdminSpy = vi
        .spyOn(AdminService, "updateAdmin")
        .mockResolvedValue(mockResult);

      const req = {} as Request;
      const res = makeMockRes({
        user: mockAuthUser,
        validatedParams: mockParams,
        validatedBody: mockPayload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AdminController.updateAdmin(req, res, next);

      expect(updateAdminSpy).toHaveBeenCalledTimes(1);
      expect(updateAdminSpy).toHaveBeenCalledWith({
        actorId: mockAuthUser.id,
        actorRole: UserRole.SUPER_ADMIN,
        targetId,
        payload: mockPayload,
      });

      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Admin account updated successfully",
        data: mockResult,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next() middleware via catchAsync", async () => {
      const serviceError = new AppError(
        status.NOT_FOUND,
        PUBLIC_ERROR_CODES.USER_NOT_FOUND,
        "Admin user not found",
      );

      vi.spyOn(AdminService, "updateAdmin").mockRejectedValue(serviceError);

      const req = {} as Request;
      const res = makeMockRes({
        user: mockAuthUser,
        validatedParams: mockParams,
        validatedBody: mockPayload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AdminController.updateAdmin(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("getAdmins", () => {
    const mockAuthUser = {
      id: "super-admin-uuid-1",
      role: UserRole.SUPER_ADMIN,
    } as AuthUser;

    const mockQuery = {
      page: 1,
      limit: 10,
      sortBy: "createdAt" as const,
      sortOrder: "desc" as const,
      searchTerm: "admin",
      status: UserStatus.ACTIVE,
    };

    const mockResult = {
      data: [
        {
          id: "admin-uuid-1",
          name: "Admin User",
          email: "admin@liminalbd.com",
          emailVerified: true,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          needPasswordChange: false,
          createdAt: new Date("2026-09-20T10:00:00.000Z"),
          updatedAt: new Date("2026-09-23T12:00:00.000Z"),
          admin: {
            contactNumber: "01700000000",
            address: "Dhaka, Bangladesh",
            createdAt: new Date("2026-09-20T10:00:00.000Z"),
            updatedAt: new Date("2026-09-20T10:00:00.000Z"),
          },
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    };

    it("should extract validated query and actor context, invoke AdminService.getAdmins, and return 200 response with data and meta", async () => {
      const getAdminsSpy = vi
        .spyOn(AdminService, "getAdmins")
        .mockResolvedValue(mockResult);

      const req = {} as Request;
      const res = makeMockRes({
        user: mockAuthUser,
        validatedQuery: mockQuery,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AdminController.getAdmins(req, res, next);

      expect(getAdminsSpy).toHaveBeenCalledTimes(1);
      expect(getAdminsSpy).toHaveBeenCalledWith({
        actorId: mockAuthUser.id,
        actorRole: UserRole.SUPER_ADMIN,
        query: mockQuery,
      });

      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Admins retrieved successfully",
        data: mockResult.data,
        meta: mockResult.meta,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next() middleware via catchAsync", async () => {
      const serviceError = new AppError(
        status.FORBIDDEN,
        PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
        "Only Super Admin can list Admin accounts",
      );

      vi.spyOn(AdminService, "getAdmins").mockRejectedValue(serviceError);

      const req = {} as Request;
      const res = makeMockRes({
        user: mockAuthUser,
        validatedQuery: mockQuery,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AdminController.getAdmins(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
