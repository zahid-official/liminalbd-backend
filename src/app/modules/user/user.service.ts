import status from "http-status";
import type { Prisma } from "../../../generated/prisma/client.js";
import { UserRole } from "../../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import type { UpdateProfileInput } from "./user.validation.js";

// Retrieve authenticated user's own profile
const getProfile = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
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

  if (!user) {
    throw new AppError(
      status.NOT_FOUND,
      PUBLIC_ERROR_CODES.USER_NOT_FOUND,
      "User not found",
    );
  }

  // Resolve role-specific profile extension
  const profileExtension =
    user.role === UserRole.CUSTOMER ? user.customer : user.admin;

  // Accurately reflect latest modification timestamp across identity and profile extension
  const updatedAt =
    profileExtension && profileExtension.updatedAt > user.updatedAt
      ? profileExtension.updatedAt
      : user.updatedAt;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    role: user.role,
    status: user.status,
    contactNumber: profileExtension?.contactNumber ?? null,
    address: profileExtension?.address ?? null,
    createdAt: user.createdAt,
    updatedAt,
  };
};

// Update authenticated user's own profile
const updateProfile = async (userId: string, payload: UpdateProfileInput) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user) {
    throw new AppError(
      status.NOT_FOUND,
      PUBLIC_ERROR_CODES.USER_NOT_FOUND,
      "User not found",
    );
  }

  // Build selective update payload for provided attributes
  const updateData: Prisma.UserUpdateInput = {};

  if (payload.name) {
    updateData.name = payload.name;
  }
  if (payload.image) {
    updateData.image = payload.image;
  }

  if (payload.contactNumber || payload.address) {
    const extensionUpdate = {
      ...(payload.contactNumber && { contactNumber: payload.contactNumber }),
      ...(payload.address && { address: payload.address }),
    };

    if (user.role === UserRole.CUSTOMER) {
      updateData.customer = { update: extensionUpdate };
    } else if (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SUPER_ADMIN
    ) {
      updateData.admin = { update: extensionUpdate };
    }
  }

  // Persist modifications atomically
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
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

  // Resolve role-specific profile extension
  const profileExtension =
    updatedUser.role === UserRole.CUSTOMER
      ? updatedUser.customer
      : updatedUser.admin;

  // Accurately reflect latest modification timestamp across identity and profile extension
  const updatedAt =
    profileExtension && profileExtension.updatedAt > updatedUser.updatedAt
      ? profileExtension.updatedAt
      : updatedUser.updatedAt;

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    emailVerified: updatedUser.emailVerified,
    image: updatedUser.image,
    role: updatedUser.role,
    status: updatedUser.status,
    contactNumber: profileExtension?.contactNumber ?? null,
    address: profileExtension?.address ?? null,
    createdAt: updatedUser.createdAt,
    updatedAt,
  };
};

export const UserService = {
  getProfile,
  updateProfile,
};
