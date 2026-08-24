import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import env from "./env.js";

// Database connection string
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

// Initialize Prisma client
const prisma = new PrismaClient({
  adapter,
});

export default prisma;
