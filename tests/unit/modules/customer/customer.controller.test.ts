import type { NextFunction, Request, Response } from "express";
import status from "http-status";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../../src/app/errors/errorCodes.js";
import type { AuthUser } from "../../../../src/app/modules/auth/auth.interface.js";
import { CustomerController } from "../../../../src/app/modules/customer/customer.controller.js";
import { CustomerService } from "../../../../src/app/modules/customer/customer.service.js";
import {
  UserRole,
  UserStatus,
} from "../../../../src/generated/prisma/enums.js";

interface MockResponseOptions {
  user?: Partial<AuthUser>;
  validatedBody?: unknown;
  validatedParams?: unknown;
}

const makeMockRes = ({
  user,
  validatedBody,
  validatedParams,
}: MockResponseOptions = {}) => {
  return {
    locals: {
      user,
      validated:
        validatedBody !== undefined || validatedParams !== undefined
          ? { body: validatedBody, params: validatedParams }
          : undefined,
    },
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
};

describe("CustomerController Unit Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("registerCustomer", () => {
    const mockPayload = {
      name: "Zahidul Islam",
      email: "zahid@liminalbd.com",
      password: "SecurePass123!",
    };

    it("should extract validated payload, convert headers faithfully, invoke CustomerService, and send 201 response", async () => {
      const mockResult = {
        id: "user-new-123",
        name: "Zahidul Islam",
        email: "zahid@liminalbd.com",
        emailVerified: false,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        createdAt: new Date("2026-09-19T10:00:00.000Z"),
      };

      const registerServiceSpy = vi
        .spyOn(CustomerService, "registerCustomer")
        .mockResolvedValue(mockResult);

      const req = {
        headers: {
          "user-agent": "Vitest-Agent",
          "x-forwarded-for": "127.0.0.1",
        },
      } as unknown as Request;

      const res = makeMockRes({ validatedBody: mockPayload });
      const next = vi.fn() as unknown as NextFunction;

      await CustomerController.registerCustomer(req, res, next);

      expect(registerServiceSpy).toHaveBeenCalledTimes(1);
      expect(registerServiceSpy).toHaveBeenCalledWith({
        payload: mockPayload,
        headers: expect.any(Headers),
      });

      const passedHeaders = registerServiceSpy.mock.calls[0]?.[0]
        ?.headers as Headers;
      expect(passedHeaders.get("x-forwarded-for")).toBe("127.0.0.1");
      expect(passedHeaders.get("user-agent")).toBe("Vitest-Agent");

      expect(res.status).toHaveBeenCalledWith(status.CREATED);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Account created successfully. Please verify your email.",
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

      vi.spyOn(CustomerService, "registerCustomer").mockRejectedValue(
        serviceError,
      );

      const req = {
        headers: {},
      } as unknown as Request;

      const res = makeMockRes({ validatedBody: mockPayload });
      const next = vi.fn() as unknown as NextFunction;

      await CustomerController.registerCustomer(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("getCustomerProfile", () => {
    const customerId = "cust-user-100";
    const mockCurrentUser: Partial<AuthUser> = {
      id: customerId,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    };
    const mockProfile = {
      id: customerId,
      name: "Zahidul Islam",
      email: "zahid@liminalbd.com",
      emailVerified: true,
      image: null,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      contactNumber: "+8801700000000",
      address: "Dhaka, Bangladesh",
      createdAt: new Date("2026-09-20T10:00:00.000Z"),
      updatedAt: new Date("2026-09-24T12:00:00.000Z"),
    };

    it("should extract params and user context, invoke CustomerService, and return 200 OK", async () => {
      const getProfileSpy = vi
        .spyOn(CustomerService, "getCustomerProfile")
        .mockResolvedValue(mockProfile);

      const req = {} as unknown as Request;
      const res = makeMockRes({
        user: mockCurrentUser,
        validatedParams: { id: customerId },
      });
      const next = vi.fn() as unknown as NextFunction;

      await CustomerController.getCustomerProfile(req, res, next);

      expect(getProfileSpy).toHaveBeenCalledTimes(1);
      expect(getProfileSpy).toHaveBeenCalledWith({
        actorId: customerId,
        actorRole: UserRole.CUSTOMER,
        targetId: customerId,
      });

      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Customer profile retrieved successfully",
        data: mockProfile,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service error to next() middleware via catchAsync", async () => {
      const serviceError = new AppError(
        status.NOT_FOUND,
        PUBLIC_ERROR_CODES.USER_NOT_FOUND,
        "Customer not found",
      );

      vi.spyOn(CustomerService, "getCustomerProfile").mockRejectedValue(
        serviceError,
      );

      const req = {} as unknown as Request;
      const res = makeMockRes({
        user: mockCurrentUser,
        validatedParams: { id: customerId },
      });
      const next = vi.fn() as unknown as NextFunction;

      await CustomerController.getCustomerProfile(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
