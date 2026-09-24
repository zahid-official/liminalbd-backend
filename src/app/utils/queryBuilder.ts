import type { PaginationMeta } from "../interfaces/response.interface.js";

// Input options contract for building standard Prisma query components
export interface BuildPrismaQueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  searchTerm?: string;
  searchableFields?: readonly string[];
}

// Search filter structure using Prisma's case-insensitive OR array
export interface SearchFilter {
  OR: Record<string, { contains: string; mode: "insensitive" }>[];
}

// Structured result providing query components consumable by Prisma
export interface BuiltPrismaQuery {
  skip: number;
  take: number;
  orderBy: Record<string, "asc" | "desc">;
  searchFilter?: SearchFilter | undefined;
  page: number;
  limit: number;
}

// Pure helper function to compute standardized pagination metadata
const buildPaginationMeta = (
  page = 1,
  limit = 10,
  total = 0,
): PaginationMeta => {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeTotal = Math.max(0, Math.floor(total));

  return {
    page: safePage,
    limit: safeLimit,
    total: safeTotal,
    totalPages: safeTotal === 0 ? 0 : Math.ceil(safeTotal / safeLimit),
  };
};

// Pure functional helper to compute pagination, sorting, and search filters for Prisma
const buildPrismaQuery = (
  options: BuildPrismaQueryOptions = {},
): BuiltPrismaQuery => {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const limit = Math.max(1, Math.floor(options.limit ?? 10));
  const skip = (page - 1) * limit;

  const sortBy = options.sortBy || "createdAt";
  const sortOrder = options.sortOrder || "desc";
  const orderBy = { [sortBy]: sortOrder };

  const searchTerm = options.searchTerm?.trim();
  const searchableFields = options.searchableFields;
  let searchFilter: SearchFilter | undefined;

  if (searchTerm && searchableFields?.length) {
    const searchConditions = searchableFields.map((field) => ({
      [field]: {
        contains: searchTerm,
        mode: "insensitive" as const,
      },
    }));

    searchFilter = { OR: searchConditions };
  }

  return {
    skip,
    take: limit,
    orderBy,
    searchFilter,
    page,
    limit,
  };
};

export { buildPaginationMeta, buildPrismaQuery };
