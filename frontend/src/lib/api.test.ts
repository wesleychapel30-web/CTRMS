import { describe, expect, it } from "vitest";
import { ApiError, isAuthError } from "./api";

describe("isAuthError", () => {
  it("returns true for 401 and 403 API errors", () => {
    expect(isAuthError(new ApiError("Unauthorized", 401))).toBe(true);
    expect(isAuthError(new ApiError("Forbidden", 403))).toBe(true);
  });

  it("returns false for non-auth API errors and other values", () => {
    expect(isAuthError(new ApiError("Bad Request", 400))).toBe(false);
    expect(isAuthError(new Error("Unauthorized"))).toBe(false);
    expect(isAuthError("Unauthorized")).toBe(false);
  });
});
