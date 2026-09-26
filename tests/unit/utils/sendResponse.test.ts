import type { Response } from "express";
import { status } from "http-status";
import { describe, expect, it, vi } from "vitest";
import { sendResponse } from "../../../src/app/utils/sendResponse.js";

// Minimal Express Response mock
const makeRes = () => {
  const json = vi.fn();
  const res = {
    status: vi.fn().mockReturnValue({ json }),
    json,
  } as unknown as Response;
  return { res, json, status: res.status as ReturnType<typeof vi.fn> };
};

describe("sendResponse Unit Tests", () => {
  describe("Standard Response Envelope", () => {
    it("sets the correct HTTP status code", () => {
      const { res, status: statusMock } = makeRes();
      sendResponse(res, { statusCode: status.OK, message: "OK", data: null });
      expect(statusMock).toHaveBeenCalledWith(status.OK);
    });

    it("returns success: true in the response body", () => {
      const { res, json } = makeRes();
      sendResponse(res, { statusCode: status.OK, message: "OK", data: null });
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it("includes the provided message in the response body", () => {
      const { res, json } = makeRes();
      sendResponse(res, {
        statusCode: status.CREATED,
        message: "Resource created",
        data: { id: 1 },
      });
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Resource created" }),
      );
    });

    it("includes the provided data in the response body", () => {
      const { res, json } = makeRes();
      const data = { id: 42, name: "Liminal" };
      sendResponse(res, { statusCode: status.OK, message: "OK", data });
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ data }));
    });
  });

  describe("Pagination Metadata (meta)", () => {
    it("omits meta when not provided", () => {
      const { res, json } = makeRes();
      sendResponse(res, { statusCode: status.OK, message: "OK", data: [] });
      const call = (json as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as Record<string, unknown>;
      expect(call).not.toHaveProperty("meta");
    });

    it("includes meta when provided", () => {
      const { res, json } = makeRes();
      const meta = { page: 1, limit: 10, total: 50, totalPages: 5 };
      sendResponse(res, {
        statusCode: status.OK,
        message: "OK",
        data: [],
        meta,
      });
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ meta }));
    });
  });
});
