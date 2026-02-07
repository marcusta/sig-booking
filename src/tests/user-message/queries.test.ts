import { describe, test, expect, beforeAll } from "bun:test";
import { bookings, type NewBooking } from "../../db/schema";
import { toDateStringUTC } from "../../date";
import { and, desc, eq, sql } from "drizzle-orm";
import { createTestDb, type TestDb, t, d } from "./helpers";

// Re-implement query logic against the test DB (same SQL, different db instance).
// This tests the query conditions themselves, not the production db singleton.
// bun-sqlite Drizzle is synchronous, so .all() returns an array directly.

function getCurrentBooking(db: TestDb, courtId: string, now: Date) {
  const nowStr = toDateStringUTC(now);
  const rows = db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.courtId, courtId),
        sql`datetime(${bookings.startTime}) <= datetime(${nowStr})`,
        sql`datetime(${bookings.endTime}) > datetime(${nowStr})`,
        eq(bookings.cancelled, false)
      )
    )
    .orderBy(bookings.startTime)
    .limit(1)
    .all();
  return rows[0] || null;
}

function getNextBooking(db: TestDb, courtId: string, now: Date) {
  const nowStr = toDateStringUTC(now);
  const limitStr = toDateStringUTC(new Date(now.getTime() + 2 * 60 * 60 * 1000));
  const rows = db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.courtId, courtId),
        sql`datetime(${bookings.startTime}) > datetime(${nowStr})`,
        sql`datetime(${bookings.startTime}) < datetime(${limitStr})`,
        eq(bookings.cancelled, false)
      )
    )
    .orderBy(bookings.startTime)
    .limit(1)
    .all();
  return rows[0] || null;
}

function getPreviousBooking(db: TestDb, courtId: string, now: Date) {
  const nowStr = toDateStringUTC(now);
  const limitStr = toDateStringUTC(new Date(now.getTime() - 1 * 60 * 60 * 1000));
  const rows = db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.courtId, courtId),
        sql`datetime(${bookings.endTime}) <= datetime(${nowStr})`,
        sql`datetime(${bookings.endTime}) > datetime(${limitStr})`,
        eq(bookings.cancelled, false)
      )
    )
    .orderBy(desc(bookings.endTime))
    .limit(1)
    .all();
  return rows[0] || null;
}

function insert(db: TestDb, id: string, overrides: Partial<NewBooking> = {}) {
  db.insert(bookings)
    .values({
      bookingId: id,
      courtId: "2068",
      courtName: "Bay 1",
      startTime: t("10:00"),
      endTime: t("10:30"),
      customerId: "cust-1",
      email: "test@test.com",
      userId: "user-1",
      firstName: "Test",
      lastName: "User",
      issuerId: "issuer-1",
      cancelled: false,
      hasShownStartMessage: false,
      hasShownEndMessage: false,
      isTest: true,
      splitPayment: false,
      ...overrides,
    })
    .run();
}

describe("getCurrentBooking", () => {
  let db: TestDb;
  beforeAll(() => {
    db = createTestDb();
    insert(db, "b1", { startTime: t("10:00"), endTime: t("10:30") });
    insert(db, "b2", { startTime: t("10:30"), endTime: t("11:00") });
    insert(db, "b3", { startTime: t("11:00"), endTime: t("12:00") });
    insert(db, "b-cancelled", { startTime: t("10:00"), endTime: t("10:30"), courtId: "2069", cancelled: true });
    insert(db, "b-other-court", { startTime: t("10:00"), endTime: t("10:30"), courtId: "2070" });
  });

  test("finds 30-min booking at start time", () => {
    const result = getCurrentBooking(db, "2068", d("10:00"));
    expect(result?.bookingId).toBe("b1");
  });

  test("finds 30-min booking mid-session", () => {
    const result = getCurrentBooking(db, "2068", d("10:15"));
    expect(result?.bookingId).toBe("b1");
  });

  test("does not find booking at exact end time (exclusive)", () => {
    const result = getCurrentBooking(db, "2068", d("10:30"));
    expect(result?.bookingId).toBe("b2");
  });

  test("finds 60-min booking mid-session", () => {
    const result = getCurrentBooking(db, "2068", d("11:30"));
    expect(result?.bookingId).toBe("b3");
  });

  test("returns null before any booking", () => {
    const result = getCurrentBooking(db, "2068", d("09:00"));
    expect(result).toBeNull();
  });

  test("returns null after all bookings", () => {
    const result = getCurrentBooking(db, "2068", d("12:00"));
    expect(result).toBeNull();
  });

  test("ignores cancelled bookings", () => {
    const result = getCurrentBooking(db, "2069", d("10:15"));
    expect(result).toBeNull();
  });

  test("filters by court", () => {
    const result = getCurrentBooking(db, "2070", d("10:15"));
    expect(result?.bookingId).toBe("b-other-court");
  });
});

describe("getNextBooking", () => {
  let db: TestDb;
  beforeAll(() => {
    db = createTestDb();
    insert(db, "b1", { startTime: t("10:00"), endTime: t("10:30") });
    insert(db, "b2", { startTime: t("10:30"), endTime: t("11:00") });
    insert(db, "b3", { startTime: t("14:00"), endTime: t("15:00") });
    insert(db, "b-cancelled", { startTime: t("10:30"), endTime: t("11:00"), courtId: "2069", cancelled: true });
  });

  test("finds booking starting after now", () => {
    const result = getNextBooking(db, "2068", d("10:00"));
    expect(result?.bookingId).toBe("b2");
  });

  test("finds first future booking when multiple exist", () => {
    const result = getNextBooking(db, "2068", d("09:00"));
    expect(result?.bookingId).toBe("b1");
  });

  test("returns null when no bookings within 2 hour lookahead", () => {
    const result = getNextBooking(db, "2068", d("11:30"));
    expect(result).toBeNull();
  });

  test("finds booking within 2 hour lookahead", () => {
    const result = getNextBooking(db, "2068", d("12:30"));
    expect(result?.bookingId).toBe("b3");
  });

  test("ignores cancelled bookings", () => {
    const result = getNextBooking(db, "2069", d("10:00"));
    expect(result).toBeNull();
  });

  test("does not include currently active bookings", () => {
    const result = getNextBooking(db, "2068", d("10:15"));
    expect(result?.bookingId).toBe("b2");
  });
});

describe("getPreviousBooking", () => {
  let db: TestDb;
  beforeAll(() => {
    db = createTestDb();
    insert(db, "b1", { startTime: t("10:00"), endTime: t("10:30") });
    insert(db, "b2", { startTime: t("10:30"), endTime: t("11:00") });
    insert(db, "b-old", { startTime: t("08:00"), endTime: t("09:00") });
    insert(db, "b-cancelled", { startTime: t("10:00"), endTime: t("10:30"), courtId: "2069", cancelled: true });
  });

  test("finds booking that just ended", () => {
    const result = getPreviousBooking(db, "2068", d("10:30"));
    expect(result?.bookingId).toBe("b1");
  });

  test("finds most recent ended booking", () => {
    const result = getPreviousBooking(db, "2068", d("11:00"));
    expect(result?.bookingId).toBe("b2");
  });

  test("returns null when no bookings within 1 hour lookback", () => {
    const result = getPreviousBooking(db, "2068", d("10:01"));
    expect(result).toBeNull();
  });

  test("finds old booking within lookback window", () => {
    const result = getPreviousBooking(db, "2068", d("09:30"));
    expect(result?.bookingId).toBe("b-old");
  });

  test("returns null before any booking ends", () => {
    const result = getPreviousBooking(db, "2068", d("07:30"));
    expect(result).toBeNull();
  });

  test("ignores cancelled bookings", () => {
    const result = getPreviousBooking(db, "2069", d("10:30"));
    expect(result).toBeNull();
  });

  test("does not include currently active bookings", () => {
    const result = getPreviousBooking(db, "2068", d("10:15"));
    expect(result).toBeNull();
  });
});
