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
}

const makeMockRes = ({ user, validatedBody }: MockResponseOptions = {}) => {
  return {
    locals: {
      user,
      validated:
        validatedBody !== undefined ? { body: validatedBody } : undefined,
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
});
