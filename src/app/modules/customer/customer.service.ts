import status from "http-status";
import type { Prisma } from "../../../generated/prisma/client.js";
import {
  AuditAction,
  AuditEntityType,
  UserRole,
  UserStatus,
} from "../../../generated/prisma/enums.js";
import { auth } from "../../config/auth.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import type { CreateAuditLogInput } from "../../shared/audit/audit.interface.js";
import { AuditService } from "../../shared/audit/audit.service.js";
import {
  buildPaginationMeta,
  buildPrismaQuery,
  type BuildPrismaQueryOptions,
} from "../../utils/queryBuilder.js";
import { CUSTOMER_SEARCHABLE_FIELDS } from "./customer.constant.js";
import type {
  DeleteCustomerInput,
  GetCustomersInput,
  RegisterCustomerInput,
  UpdateCustomerStatusInput,
} from "./customer.interface.js";

// Register customer account
const registerCustomer = async ({
  headers,
  payload,
}: RegisterCustomerInput) => {
  const { name, email, password } = payload;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AppError(
      status.CONFLICT,
      PUBLIC_ERROR_CODES.USER_ALREADY_EXISTS,
      "User with this email already exists",
    );
  }

  const authResult = await auth.api.signUpEmail({
    body: {
      name,
      email,
      password,
    },
    headers,
  });

  if (!authResult?.user) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR,
      "Failed to register user account",
    );
  }

  // Dispatch verification OTP only after account and customer profile are committed
  await auth.api.sendVerificationOTP({
    body: {
      email,
      type: "email-verification",
    },
    headers,
  });

  return {
    id: authResult.user.id,
    name: authResult.user.name,
    email: authResult.user.email,
    emailVerified: authResult.user.emailVerified,
    role: authResult.user.role,
    status: authResult.user.status,
    createdAt: authResult.user.createdAt,
  };
};

// Retrieve paginated Customer accounts (Admin only)
const getCustomers = async ({
  actorId,
  actorRole,
  query,
}: GetCustomersInput) => {
  if (actorRole !== UserRole.ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
    await AuditService.record({
      actorId,
      action: AuditAction.UNAUTHORIZED_ATTEMPT,
      entityType: AuditEntityType.CUSTOMER,
      metadata: {
        attemptedAction: "GET_CUSTOMERS",
        attemptedRole: actorRole,
        reason: "FORBIDDEN_ROLE_ACCESS",
      },
    });

    throw new AppError(
      status.FORBIDDEN,
      PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      "Only administrators can list Customer accounts",
    );
  }

  // Assemble query options for pagination, sorting and search
  const queryOptions: BuildPrismaQueryOptions = {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    searchableFields: CUSTOMER_SEARCHABLE_FIELDS,
  };

  if (query.searchTerm) {
    queryOptions.searchTerm = query.searchTerm;
  }

  const { skip, take, orderBy, searchFilter, page, limit } =
    buildPrismaQuery(queryOptions);

  // Assemble query filters excluding soft-deleted and non-customer users
  const where: Prisma.UserWhereInput = {
    role: UserRole.CUSTOMER,
    deletedAt: null,
    ...searchFilter,
  };

  if (query.status) {
    where.status = query.status;
  }

  if (query.startDate || query.endDate) {
    const createdAtFilter: Prisma.DateTimeFilter = {};

    if (query.startDate) {
      createdAtFilter.gte = query.startDate;
    }

    if (query.endDate) {
      createdAtFilter.lte = query.endDate;
    }

    where.createdAt = createdAtFilter;
  }

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy,
      include: { customer: true },
    }),
    prisma.user.count({ where }),
  ]);

  const formattedCustomers = customers.map((customerUser) => {
    const updatedAt =
      customerUser.customer &&
      customerUser.customer.updatedAt > customerUser.updatedAt
        ? customerUser.customer.updatedAt
        : customerUser.updatedAt;

    return {
      id: customerUser.id,
      name: customerUser.name,
      email: customerUser.email,
      emailVerified: customerUser.emailVerified,
      image: customerUser.image,
      role: customerUser.role,
      status: customerUser.status,
      contactNumber: customerUser.customer?.contactNumber,
      address: customerUser.customer?.address,
      createdAt: customerUser.createdAt,
      updatedAt,
    };
  });

  return {
    data: formattedCustomers,
    meta: buildPaginationMeta(page, limit, total),
  };
};

// Retrieve customer by ID (Admin only)
const getCustomerById = async (customerId: string) => {
  const targetUser = await prisma.user.findUnique({
    where: { id: customerId },
    include: { customer: true },
  });

  if (
    !targetUser ||
    targetUser.role !== UserRole.CUSTOMER ||
    targetUser.deletedAt !== null
  ) {
    throw new AppError(
      status.NOT_FOUND,
      PUBLIC_ERROR_CODES.USER_NOT_FOUND,
      "Customer not found",
    );
  }

  // Accurately reflect the latest modification timestamp across user identity and customer profile
  const updatedAt =
    targetUser.customer && targetUser.customer.updatedAt > targetUser.updatedAt
      ? targetUser.customer.updatedAt
      : targetUser.updatedAt;

  return {
    id: targetUser.id,
    name: targetUser.name,
    email: targetUser.email,
    emailVerified: targetUser.emailVerified,
    image: targetUser.image,
    role: targetUser.role,
    status: targetUser.status,
    contactNumber: targetUser.customer?.contactNumber,
    address: targetUser.customer?.address,
    createdAt: targetUser.createdAt,
    updatedAt,
  };
};

// Update Customer account status (Admin only)
const updateCustomerStatus = async ({
  actorId,
  actorRole,
  customerId,
  payload,
}: UpdateCustomerStatusInput) => {
  if (actorRole !== UserRole.ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
    await AuditService.record({
      actorId,
      action: AuditAction.UNAUTHORIZED_ATTEMPT,
      entityType: AuditEntityType.CUSTOMER,
      entityId: customerId,
      metadata: {
        attemptedAction: "UPDATE_CUSTOMER_STATUS",
        attemptedRole: actorRole,
        reason: "FORBIDDEN_ROLE_ACCESS",
      },
    });

    throw new AppError(
      status.FORBIDDEN,
      PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      "Only administrators can update Customer account status",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: { id: customerId },
      include: { customer: true },
    });

    if (
      !targetUser ||
      targetUser.role !== UserRole.CUSTOMER ||
      targetUser.deletedAt !== null
    ) {
      throw new AppError(
        status.NOT_FOUND,
        PUBLIC_ERROR_CODES.USER_NOT_FOUND,
        "Customer not found",
      );
    }

    if (targetUser.status === payload.status) {
      throw new AppError(
        status.BAD_REQUEST,
        PUBLIC_ERROR_CODES.VALIDATION_ERROR,
        `Customer account is already ${payload.status.toLowerCase()}`,
      );
    }

    const updatedUser = await tx.user.update({
      where: { id: customerId },
      data: { status: payload.status },
    });

    // Invalidate all active sessions if restricting account access
    if (
      payload.status === UserStatus.SUSPENDED ||
      payload.status === UserStatus.DEACTIVATED
    ) {
      await tx.session.deleteMany({
        where: { userId: customerId },
      });
    }

    let action: AuditAction = AuditAction.REACTIVATE;
    if (payload.status === UserStatus.SUSPENDED) {
      action = AuditAction.SUSPEND;
    } else if (payload.status === UserStatus.DEACTIVATED) {
      action = AuditAction.DEACTIVATE;
    }

    const auditData: CreateAuditLogInput = {
      action,
      entityType: AuditEntityType.CUSTOMER,
      entityId: customerId,
      previousValue: { status: targetUser.status },
      newValue: { status: payload.status },
      tx,
    };

    if (actorId) {
      auditData.actorId = actorId;
    }
    if (payload.reason) {
      auditData.metadata = { reason: payload.reason };
    }

    await AuditService.record(auditData);

    const updatedAt =
      targetUser.customer &&
      targetUser.customer.updatedAt > updatedUser.updatedAt
        ? targetUser.customer.updatedAt
        : updatedUser.updatedAt;

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      emailVerified: updatedUser.emailVerified,
      image: updatedUser.image,
      role: updatedUser.role,
      status: updatedUser.status,
      contactNumber: targetUser.customer?.contactNumber,
      address: targetUser.customer?.address,
      createdAt: updatedUser.createdAt,
      updatedAt,
    };
  });

  return result;
};

// Soft-delete Customer account (Admin only)
const deleteCustomer = async ({
  actorId,
  actorRole,
  customerId,
  payload,
}: DeleteCustomerInput) => {
  if (actorRole !== UserRole.ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
    await AuditService.record({
      actorId,
      action: AuditAction.UNAUTHORIZED_ATTEMPT,
      entityType: AuditEntityType.CUSTOMER,
      entityId: customerId,
      metadata: {
        attemptedAction: "DELETE_CUSTOMER",
        attemptedRole: actorRole,
        reason: "FORBIDDEN_ROLE_ACCESS",
      },
    });

    throw new AppError(
      status.FORBIDDEN,
      PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      "Only administrators can delete Customer accounts",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: { id: customerId },
      select: { id: true, role: true, deletedAt: true },
    });

    if (
      !targetUser ||
      targetUser.role !== UserRole.CUSTOMER ||
      targetUser.deletedAt !== null
    ) {
      throw new AppError(
        status.NOT_FOUND,
        PUBLIC_ERROR_CODES.USER_NOT_FOUND,
        "Customer not found",
      );
    }

    const updatedUser = await tx.user.update({
      where: { id: customerId },
      data: { deletedAt: new Date() },
    });

    // Invalidate all active sessions for the soft-deleted account
    await tx.session.deleteMany({
      where: { userId: customerId },
    });

    const auditData: CreateAuditLogInput = {
      action: AuditAction.SOFT_DELETE,
      entityType: AuditEntityType.CUSTOMER,
      entityId: customerId,
      previousValue: { deletedAt: targetUser.deletedAt },
      newValue: { deletedAt: updatedUser.deletedAt },
      tx,
    };

    if (actorId) {
      auditData.actorId = actorId;
    }
    if (payload?.reason) {
      auditData.metadata = { reason: payload.reason };
    }

    await AuditService.record(auditData);

    return {
      id: updatedUser.id,
      deletedAt: updatedUser.deletedAt,
    };
  });

  return result;
};

// Export customer service
export const CustomerService = {
  registerCustomer,
  getCustomers,
  getCustomerById,
  updateCustomerStatus,
  deleteCustomer,
};
