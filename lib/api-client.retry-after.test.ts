import { describe, it, expect } from "vitest";
import { retryAfterSeconds } from "./api-client";

describe("retryAfterSeconds", () => {
  it("reads delta-seconds", () => {
    expect(retryAfterSeconds("42")).toBe(42);
  });

  it("reads an HTTP date as the seconds left", () => {
    const now = Date.parse("2026-11-18T08:00:00Z");
    expect(retryAfterSeconds("Wed, 18 Nov 2026 08:00:30 GMT", now)).toBe(30);
  });

  it("ignores a missing or unreadable header", () => {
    expect(retryAfterSeconds(undefined)).toBeUndefined();
    expect(retryAfterSeconds("soon")).toBeUndefined();
  });
});
