import status from "http-status";
import type { Prisma } from "../../../generated/prisma/client.js";
import {
  AuditAction,
  AuditEntityType,
  UserRole,
} from "../../../generated/prisma/enums.js";
import { auth } from "../../config/auth.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import { AuditService } from "../../shared/audit/audit.service.js";
import {
  buildPaginationMeta,
  buildPrismaQuery,
  type BuildPrismaQueryOptions,
} from "../../utils/queryBuilder.js";
import { CUSTOMER_SEARCHABLE_FIELDS } from "./customer.constant.js";
import type {
  GetCustomersInput,
  RegisterCustomerInput,
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

// Export customer service
export const CustomerService = {
  registerCustomer,
  getCustomers,
  getCustomerById,
};
