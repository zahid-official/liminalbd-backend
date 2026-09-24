import { describe, expect, it } from "vitest";
import {
  buildPaginationMeta,
  buildPrismaQuery,
} from "../../../src/app/utils/queryBuilder.js";

describe("queryBuilder Unit Tests", () => {
  describe("buildPaginationMeta", () => {
    it("should calculate pagination meta with default arguments", () => {
      const meta = buildPaginationMeta();

      expect(meta).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      });
    });

    it("should correctly calculate pagination metadata for positive total", () => {
      const meta = buildPaginationMeta(2, 10, 25);

      expect(meta).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it("should return totalPages 0 when total is 0", () => {
      const meta = buildPaginationMeta(1, 10, 0);

      expect(meta).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      });
    });

    it("should calculate exact totalPages when total is cleanly divisible by limit", () => {
      const meta = buildPaginationMeta(1, 10, 30);

      expect(meta.totalPages).toBe(3);
    });

    it("should safely clamp non-positive page, limit, and total", () => {
      const meta = buildPaginationMeta(-1, 0, -10);

      expect(meta).toEqual({
        page: 1,
        limit: 1,
        total: 0,
        totalPages: 0,
      });
    });

    it("should floor floating-point inputs to safe integers", () => {
      const meta = buildPaginationMeta(2.9, 10.8, 30.7);

      expect(meta).toEqual({
        page: 2,
        limit: 10,
        total: 30,
        totalPages: 3,
      });
    });
  });

  describe("buildPrismaQuery", () => {
    it("should assemble default query options when no options are provided", () => {
      const result = buildPrismaQuery();

      expect(result).toEqual({
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
        searchFilter: undefined,
        page: 1,
        limit: 10,
      });
    });

    it("should compute skip and take correctly for custom page and limit", () => {
      const result = buildPrismaQuery({ page: 3, limit: 15 });

      expect(result.skip).toBe(30);
      expect(result.take).toBe(15);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(15);
    });

    it("should floor floating-point page and limit to safe integers", () => {
      const result = buildPrismaQuery({ page: 2.7, limit: 10.9 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.skip).toBe(10);
      expect(result.take).toBe(10);
    });

    it("should format custom sortBy and sortOrder correctly", () => {
      const result = buildPrismaQuery({
        sortBy: "name",
        sortOrder: "asc",
      });

      expect(result.orderBy).toEqual({ name: "asc" });
    });

    it("should fallback to desc when sortOrder is omitted or not asc", () => {
      const result = buildPrismaQuery({
        sortBy: "email",
        sortOrder: "desc",
      });

      expect(result.orderBy).toEqual({ email: "desc" });
    });

    it("should fallback to createdAt if sortBy is omitted", () => {
      const result = buildPrismaQuery();

      expect(result.orderBy).toEqual({ createdAt: "desc" });
    });

    it("should construct case-insensitive OR searchFilter when searchTerm and fields are valid", () => {
      const result = buildPrismaQuery({
        searchTerm: "admin",
        searchableFields: ["name", "email"],
      });

      expect(result.searchFilter).toEqual({
        OR: [
          { name: { contains: "admin", mode: "insensitive" } },
          { email: { contains: "admin", mode: "insensitive" } },
        ],
      });
    });

    it("should trim surrounding whitespace from searchTerm", () => {
      const result = buildPrismaQuery({
        searchTerm: "  admin  ",
        searchableFields: ["name", "email"],
      });

      expect(result.searchFilter).toEqual({
        OR: [
          { name: { contains: "admin", mode: "insensitive" } },
          { email: { contains: "admin", mode: "insensitive" } },
        ],
      });
    });

    it("should return searchFilter undefined if searchTerm is empty or whitespace only", () => {
      expect(
        buildPrismaQuery({
          searchTerm: "",
          searchableFields: ["name", "email"],
        }).searchFilter,
      ).toBeUndefined();

      expect(
        buildPrismaQuery({
          searchTerm: "   ",
          searchableFields: ["name", "email"],
        }).searchFilter,
      ).toBeUndefined();
    });

    it("should return searchFilter undefined if searchableFields is empty or undefined", () => {
      expect(
        buildPrismaQuery({ searchTerm: "admin" }).searchFilter,
      ).toBeUndefined();
      expect(
        buildPrismaQuery({ searchTerm: "admin", searchableFields: [] })
          .searchFilter,
      ).toBeUndefined();
    });
  });
});
