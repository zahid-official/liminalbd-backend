import crypto from "node:crypto";
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import {
  AuditAction,
  AuditEntityType,
  UserRole,
  UserStatus,
} from "../src/generated/prisma/enums.js";
import { env } from "../src/app/config/env.js";
import { logger } from "../src/app/config/logger.js";
import { prisma } from "../src/app/config/prisma.js";
import { ConfigurationError } from "../src/app/errors/ConfigurationError.js";
import { AuditService } from "../src/app/shared/audit/audit.service.js";
import { passwordSchema } from "../src/app/validations/common.validation.js";

// Provision initial Super Admin account idempotently
export const seedSuperAdmin = async () => {
  const name = env.SUPER_ADMIN_NAME;
  const email = env.SUPER_ADMIN_EMAIL;
  const password = env.SUPER_ADMIN_PASSWORD;

  // Guard against missing environment credentials
  if (!email || !password) {
    logger.info(
      "SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is not set in environment. Skipping provisioning.",
    );
    return;
  }

  // Validate password complexity against enterprise policy
  const passwordValidation = passwordSchema.safeParse(password);
  if (!passwordValidation.success) {
    const errorMessages = passwordValidation.error.issues
      .map((issue) => issue.message)
      .join("; ");
    throw new ConfigurationError(
      `Super Admin password in environment does not meet security complexity requirements: ${errorMessages}`,
    );
  }

  // Assert idempotency to prevent duplicate Super Admin creation
  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      role: UserRole.SUPER_ADMIN,
      deletedAt: null,
    },
    select: { id: true, email: true },
  });

  if (existingSuperAdmin) {
    logger.info(
      `Super Admin account already exists (${existingSuperAdmin.email}). Skipping provisioning.`,
    );
    return;
  }

  // Verify email uniqueness across existing user accounts
  const existingEmailUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (existingEmailUser) {
    logger.warn(
      `User with email "${email}" already exists with role ${existingEmailUser.role}. Skipping provisioning.`,
    );
    return;
  }

  // Hash password using Better Auth timing-safe crypto utility
  const hashedPassword = await hashPassword(password);
  const userId = crypto.randomUUID();

  // Provision User, Account, Admin profile, and Audit Log in an atomic transaction
  await prisma.$transaction(async (tx) => {
    // Create root user record
    await tx.user.create({
      data: {
        id: userId,
        name,
        email,
        emailVerified: true,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        needPasswordChange: true,
      },
    });

    // Link credential account for Better Auth authentication
    await tx.account.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    // Initialize linked Admin profile record
    await tx.admin.create({
      data: {
        userId,
      },
    });

    // Record initial system provisioning in audit log
    await AuditService.record({
      actorId: userId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.ADMIN,
      entityId: userId,
      newValue: {
        id: userId,
        name,
        email,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        needPasswordChange: true,
      },
      metadata: {
        source: "SEED_SCRIPT",
        description: "Initial Super Admin provisioning via Prisma database seed",
      },
      tx,
    });
  });

  logger.info(`Super Admin provisioned successfully: ${email}`);
};

// Main execution function
const runSeed = async () => {
  try {
    await seedSuperAdmin();
  } catch (error) {
    logger.error({ err: error }, "Seed execution failed");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

// Auto-run if executed directly as entrypoint
const isMainModule =
  process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js");

if (isMainModule) {
  runSeed();
}
