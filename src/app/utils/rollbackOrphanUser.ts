import { prisma } from "../config/prisma.js";

// Helper to safely rollback orphan user without shadowing the primary failure
export const rollbackOrphanUser = async (
  userId: string,
  primaryError: unknown,
) => {
  // eslint-disable-next-line no-console
  console.error("Profile creation failed, rolling back orphan user:", {
    userId,
    primaryError,
  });

  try {
    await prisma.user.delete({
      where: { id: userId },
    });
  } catch (rollbackError) {
    // eslint-disable-next-line no-console
    console.error(
      "Critical: Failed to rollback orphan user during profile creation failure:",
      {
        userId,
        primaryError,
        rollbackError,
      },
    );
  }
};
