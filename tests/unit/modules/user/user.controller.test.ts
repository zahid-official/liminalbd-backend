import type { NextFunction, Request, Response } from "express";
import status from "http-status";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole, UserStatus } from "../../../../src/generated/prisma/enums.js";
import type { AuthUser } from "../../../../src/app/modules/auth/auth.interface.js";
import { UserController } from "../../../../src/app/modules/user/user.controller.js";
import { UserService } from "../../../../src/app/modules/user/user.service.js";

const makeMockRes = (locals: {
  user?: Partial<AuthUser>;
  validatedBody?: unknown;
}) => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    locals: {
      user: locals.user,
      validated: {
        body: locals.validatedBody,
      },
    },
  } as unknown as Response;
  return res;
};

describe("UserController Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser: Partial<AuthUser> = {
    id: "user-123",
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
  };

  const mockProfile = {
    id: "user-123",
    name: "Zahidul Islam",
    email: "zahid@liminalbd.com",
    emailVerified: true,
    image: null,
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    contactNumber: "01969658962",
    address: "Dhaka, Bangladesh",
    createdAt: new Date("2026-09-20T10:00:00.000Z"),
    updatedAt: new Date("2026-09-25T12:00:00.000Z"),
  };

  describe("getProfile", () => {
    it("should extract user.id from res.locals, invoke UserService.getProfile, and return 200 OK", async () => {
      const getProfileSpy = vi
        .spyOn(UserService, "getProfile")
        .mockResolvedValue(mockProfile);

      const req = {} as unknown as Request;
      const res = makeMockRes({ user: mockUser });
      const next = vi.fn() as unknown as NextFunction;

      await UserController.getProfile(req, res, next);

      expect(getProfileSpy).toHaveBeenCalledWith("user-123");
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Profile retrieved successfully",
        data: mockProfile,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should pass errors to next function", async () => {
      const error = new Error("Database error");
      vi.spyOn(UserService, "getProfile").mockRejectedValue(error);

      const req = {} as unknown as Request;
      const res = makeMockRes({ user: mockUser });
      const next = vi.fn() as unknown as NextFunction;

      await UserController.getProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("updateProfile", () => {
    it("should extract user.id and validated body, invoke UserService.updateProfile, and return 200 OK", async () => {
      const updatePayload = {
        name: "Updated Name",
        contactNumber: "01969658962",
      };

      const updateProfileSpy = vi
        .spyOn(UserService, "updateProfile")
        .mockResolvedValue({
          ...mockProfile,
          name: "Updated Name",
        });

      const req = {} as unknown as Request;
      const res = makeMockRes({
        user: mockUser,
        validatedBody: updatePayload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await UserController.updateProfile(req, res, next);

      expect(updateProfileSpy).toHaveBeenCalledWith({
        userId: "user-123",
        payload: updatePayload,
      });
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Profile updated successfully",
        data: {
          ...mockProfile,
          name: "Updated Name",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should pass errors to next function", async () => {
      const error = new Error("Update failure");
      vi.spyOn(UserService, "updateProfile").mockRejectedValue(error);

      const req = {} as unknown as Request;
      const res = makeMockRes({
        user: mockUser,
        validatedBody: { name: "Test" },
      });
      const next = vi.fn() as unknown as NextFunction;

      await UserController.updateProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
