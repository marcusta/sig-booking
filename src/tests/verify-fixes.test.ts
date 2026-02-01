import { describe, test, expect } from "bun:test";
import { toDateStringUTC } from "../date";

// Pure function mirroring the SQL overlap condition: startTime < end AND endTime > start
function bookingOverlapsWindow(
  bookingStart: Date,
  bookingEnd: Date,
  windowStart: Date,
  windowEnd: Date
): boolean {
  return bookingStart < windowEnd && bookingEnd > windowStart;
}

describe("Overlap query logic", () => {
  const windowStart = new Date("2025-01-15T10:00:00Z");
  const windowEnd = new Date("2025-01-15T11:00:00Z");

  test("booking fully within window → true", () => {
    const result = bookingOverlapsWindow(
      new Date("2025-01-15T10:15:00Z"),
      new Date("2025-01-15T10:45:00Z"),
      windowStart,
      windowEnd
    );
    expect(result).toBe(true);
  });

  test("booking started before window, ends during → true", () => {
    const result = bookingOverlapsWindow(
      new Date("2025-01-15T09:30:00Z"),
      new Date("2025-01-15T10:30:00Z"),
      windowStart,
      windowEnd
    );
    expect(result).toBe(true);
  });

  test("booking started during window, ends after → true", () => {
    const result = bookingOverlapsWindow(
      new Date("2025-01-15T10:30:00Z"),
      new Date("2025-01-15T11:30:00Z"),
      windowStart,
      windowEnd
    );
    expect(result).toBe(true);
  });

  test("booking spans entire window → true", () => {
    const result = bookingOverlapsWindow(
      new Date("2025-01-15T09:00:00Z"),
      new Date("2025-01-15T12:00:00Z"),
      windowStart,
      windowEnd
    );
    expect(result).toBe(true);
  });

  test("booking ended before window → false", () => {
    const result = bookingOverlapsWindow(
      new Date("2025-01-15T08:00:00Z"),
      new Date("2025-01-15T09:00:00Z"),
      windowStart,
      windowEnd
    );
    expect(result).toBe(false);
  });

  test("booking starts after window → false", () => {
    const result = bookingOverlapsWindow(
      new Date("2025-01-15T12:00:00Z"),
      new Date("2025-01-15T13:00:00Z"),
      windowStart,
      windowEnd
    );
    expect(result).toBe(false);
  });

  test("booking ends exactly at window start → false (no overlap)", () => {
    const result = bookingOverlapsWindow(
      new Date("2025-01-15T09:00:00Z"),
      new Date("2025-01-15T10:00:00Z"),
      windowStart,
      windowEnd
    );
    expect(result).toBe(false);
  });

  test("booking starts exactly at window end → false (no overlap)", () => {
    const result = bookingOverlapsWindow(
      new Date("2025-01-15T11:00:00Z"),
      new Date("2025-01-15T12:00:00Z"),
      windowStart,
      windowEnd
    );
    expect(result).toBe(false);
  });
});

describe("isNearNewHour", () => {
  // isNearNewHour uses new Date() internally, so we test by mocking Date
  // We re-import after mocking to get fresh behavior

  test("at :56 minutes → isJustBefore=true, isJustAfter=false", () => {
    const original = globalThis.Date;
    const mock = new original("2025-01-15T10:56:00Z");
    globalThis.Date = class extends original {
      constructor(...args: any[]) {
        if (args.length === 0) return mock as any;
        // @ts-ignore
        super(...args);
      }
      static UTC = original.UTC;
    } as any;

    // Re-require to use mocked Date
    const { isNearNewHour } = require("../date");
    const result = isNearNewHour();
    expect(result.isJustBefore).toBe(true);
    expect(result.isJustAfter).toBe(false);

    globalThis.Date = original;
  });

  test("at :30 minutes → both false", () => {
    const original = globalThis.Date;
    const mock = new original("2025-01-15T10:30:00Z");
    globalThis.Date = class extends original {
      constructor(...args: any[]) {
        if (args.length === 0) return mock as any;
        // @ts-ignore
        super(...args);
      }
      static UTC = original.UTC;
    } as any;

    const { isNearNewHour } = require("../date");
    const result = isNearNewHour();
    expect(result.isJustBefore).toBe(false);
    expect(result.isJustAfter).toBe(false);

    globalThis.Date = original;
  });

  test("at :03 minutes → isJustBefore=false, isJustAfter=true", () => {
    const original = globalThis.Date;
    const mock = new original("2025-01-15T10:03:00Z");
    globalThis.Date = class extends original {
      constructor(...args: any[]) {
        if (args.length === 0) return mock as any;
        // @ts-ignore
        super(...args);
      }
      static UTC = original.UTC;
    } as any;

    const { isNearNewHour } = require("../date");
    const result = isNearNewHour();
    expect(result.isJustBefore).toBe(false);
    expect(result.isJustAfter).toBe(true);

    globalThis.Date = original;
  });
});

describe("toDateStringUTC", () => {
  test("formats a UTC date correctly", () => {
    const date = new Date("2025-06-15T08:30:45Z");
    expect(toDateStringUTC(date)).toBe("2025-06-15T08:30:45Z");
  });

  test("pads single-digit months and days", () => {
    const date = new Date("2025-01-05T03:07:09Z");
    expect(toDateStringUTC(date)).toBe("2025-01-05T03:07:09Z");
  });

  test("throws on invalid date", () => {
    expect(() => toDateStringUTC(new Date("invalid"))).toThrow(
      "Invalid date provided to toDateStringUTC"
    );
  });

  test("handles midnight correctly", () => {
    const date = new Date("2025-12-31T00:00:00Z");
    expect(toDateStringUTC(date)).toBe("2025-12-31T00:00:00Z");
  });
});
