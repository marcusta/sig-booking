import { describe, test, expect } from "bun:test";
import { buildContext, evaluateRules } from "../../user_message";
import { makeBooking, t, d } from "./helpers";
import type { Booking } from "../../db/schema";

// Scenario tests walk through time-advancing sequences matching the doc examples.
// We use buildContext + evaluateRules (pure functions) and manually track the
// hasShownStartMessage / hasShownEndMessage flags as the orchestrator would.

function withFlags(
  booking: Booking,
  flags: { hasShownStartMessage?: boolean; hasShownEndMessage?: boolean }
): Booking {
  return { ...booking, ...flags };
}

function evaluate(
  current: Booking | null,
  next: Booking | null,
  previous: Booking | null,
  now: Date
) {
  const ctx = buildContext(current, next, previous, now);
  return evaluateRules(ctx);
}

describe("Scenario 1: Single 60-minute booking", () => {
  const A = makeBooking({
    startTime: t("14:00"), endTime: t("15:00"),
    customerId: "A", firstName: "Alice",
  });

  test("13:57 — early welcome", () => {
    const result = evaluate(null, A, null, d("13:57"));
    expect(result?.ruleName).toBe("early-welcome");
    expect(result?.type).toBe("start");
  });

  test("14:00 — start already shown, mid-session", () => {
    const a = withFlags(A, { hasShownStartMessage: true });
    const result = evaluate(a, null, null, d("14:00"));
    expect(result).toBeNull();
  });

  test("14:30 — mid-session", () => {
    const a = withFlags(A, { hasShownStartMessage: true });
    const result = evaluate(a, null, null, d("14:30"));
    expect(result).toBeNull();
  });

  test("14:55 — ending free", () => {
    const a = withFlags(A, { hasShownStartMessage: true });
    const result = evaluate(a, null, null, d("14:55"));
    expect(result?.ruleName).toBe("ending-free");
    expect(result?.type).toBe("end-free");
  });
});

describe("Scenario 2: Single 30-minute booking", () => {
  const A = makeBooking({
    startTime: t("10:00"), endTime: t("10:30"),
    customerId: "A", firstName: "Alice",
  });

  test("09:57 — early welcome", () => {
    const result = evaluate(null, A, null, d("09:57"));
    expect(result?.ruleName).toBe("early-welcome");
    expect(result?.type).toBe("start");
  });

  test("10:00 — start already shown", () => {
    const a = withFlags(A, { hasShownStartMessage: true });
    const result = evaluate(a, null, null, d("10:00"));
    expect(result).toBeNull();
  });

  test("10:15 — mid-session", () => {
    const a = withFlags(A, { hasShownStartMessage: true });
    const result = evaluate(a, null, null, d("10:15"));
    expect(result).toBeNull();
  });

  test("10:25 — ending free", () => {
    const a = withFlags(A, { hasShownStartMessage: true });
    const result = evaluate(a, null, null, d("10:25"));
    expect(result?.ruleName).toBe("ending-free");
    expect(result?.type).toBe("end-free");
  });
});

describe("Scenario 3: Back-to-back same customer (3 x 30 min)", () => {
  const A1 = makeBooking({
    startTime: t("10:00"), endTime: t("10:30"),
    customerId: "A", firstName: "Alice",
  });
  const A2 = makeBooking({
    startTime: t("10:30"), endTime: t("11:00"),
    customerId: "A", firstName: "Alice",
  });
  const A3 = makeBooking({
    startTime: t("11:00"), endTime: t("11:30"),
    customerId: "A", firstName: "Alice",
  });

  test("09:57 — early welcome for first slot", () => {
    const result = evaluate(null, A1, null, d("09:57"));
    expect(result?.ruleName).toBe("early-welcome");
    expect(result?.type).toBe("start");
  });

  test("10:00 — start already shown", () => {
    const a1 = withFlags(A1, { hasShownStartMessage: true });
    const result = evaluate(a1, A2, null, d("10:00"));
    expect(result).toBeNull();
  });

  test("10:25 — ending-continuation (next is same customer)", () => {
    const a1 = withFlags(A1, { hasShownStartMessage: true });
    const result = evaluate(a1, A2, null, d("10:25"));
    expect(result?.ruleName).toBe("ending-continuation");
    expect(result?.type).toBeNull();
  });

  test("10:30 — welcome-continuation for second slot", () => {
    const a1 = withFlags(A1, { hasShownStartMessage: true, hasShownEndMessage: true });
    const result = evaluate(A2, A3, a1, d("10:30"));
    expect(result?.ruleName).toBe("welcome-continuation");
    expect(result?.type).toBeNull();
  });

  test("10:55 — ending-continuation for second slot", () => {
    const a2 = withFlags(A2, { hasShownStartMessage: true });
    const result = evaluate(a2, A3, null, d("10:55"));
    expect(result?.ruleName).toBe("ending-continuation");
    expect(result?.type).toBeNull();
  });

  test("11:00 — welcome-continuation for third slot", () => {
    const a2 = withFlags(A2, { hasShownStartMessage: true, hasShownEndMessage: true });
    const result = evaluate(A3, null, a2, d("11:00"));
    expect(result?.ruleName).toBe("welcome-continuation");
    expect(result?.type).toBeNull();
  });

  test("11:25 — ending-free for last slot", () => {
    const a3 = withFlags(A3, { hasShownStartMessage: true });
    const result = evaluate(a3, null, null, d("11:25"));
    expect(result?.ruleName).toBe("ending-free");
    expect(result?.type).toBe("end-free");
  });
});

describe("Scenario 4: Handoff between two customers", () => {
  const A = makeBooking({
    startTime: t("10:00"), endTime: t("10:30"),
    customerId: "A", firstName: "Alice",
  });
  const B = makeBooking({
    startTime: t("10:30"), endTime: t("11:00"),
    customerId: "B", firstName: "Bob",
  });

  test("09:57 — early welcome for A", () => {
    const result = evaluate(null, A, null, d("09:57"));
    expect(result?.ruleName).toBe("early-welcome");
    expect(result?.type).toBe("start");
  });

  test("10:15 — mid-session", () => {
    const a = withFlags(A, { hasShownStartMessage: true });
    const result = evaluate(a, B, null, d("10:15"));
    expect(result).toBeNull();
  });

  test("10:25 — ending-occupied (next is different customer)", () => {
    const a = withFlags(A, { hasShownStartMessage: true });
    const result = evaluate(a, B, null, d("10:25"));
    expect(result?.ruleName).toBe("ending-occupied");
    expect(result?.type).toBe("end-occupied");
  });

  test("10:30 — welcome for B (different customer than previous)", () => {
    const a = withFlags(A, { hasShownStartMessage: true, hasShownEndMessage: true });
    const result = evaluate(B, null, a, d("10:30"));
    expect(result?.ruleName).toBe("welcome");
    expect(result?.type).toBe("start");
  });

  test("10:55 — ending-free for B", () => {
    const b = withFlags(B, { hasShownStartMessage: true });
    const result = evaluate(b, null, null, d("10:55"));
    expect(result?.ruleName).toBe("ending-free");
    expect(result?.type).toBe("end-free");
  });
});

describe("Scenario 5: Gap between bookings", () => {
  const A = makeBooking({
    startTime: t("10:00"), endTime: t("10:30"),
    customerId: "A", firstName: "Alice",
  });
  const B = makeBooking({
    startTime: t("11:00"), endTime: t("11:30"),
    customerId: "B", firstName: "Bob",
  });

  test("10:25 — ending-free (next doesn't start at endTime)", () => {
    const a = withFlags(A, { hasShownStartMessage: true });
    const result = evaluate(a, B, null, d("10:25"));
    expect(result?.ruleName).toBe("ending-free");
    expect(result?.type).toBe("end-free");
  });

  test("10:30 — no message (gap, next is 30 min away)", () => {
    const result = evaluate(null, B, null, d("10:30"));
    expect(result).toBeNull();
  });

  test("10:57 — early welcome for B", () => {
    const result = evaluate(null, B, null, d("10:57"));
    expect(result?.ruleName).toBe("early-welcome");
    expect(result?.type).toBe("start");
  });
});

describe("Scenario 6: Mixed durations back-to-back", () => {
  const A1 = makeBooking({
    startTime: t("10:00"), endTime: t("11:00"),
    customerId: "A", firstName: "Alice",
  });
  const A2 = makeBooking({
    startTime: t("11:00"), endTime: t("11:30"),
    customerId: "A", firstName: "Alice",
  });

  test("09:57 — early welcome", () => {
    const result = evaluate(null, A1, null, d("09:57"));
    expect(result?.ruleName).toBe("early-welcome");
    expect(result?.type).toBe("start");
  });

  test("10:30 — mid-session", () => {
    const a1 = withFlags(A1, { hasShownStartMessage: true });
    const result = evaluate(a1, A2, null, d("10:30"));
    expect(result).toBeNull();
  });

  test("10:55 — ending-continuation", () => {
    const a1 = withFlags(A1, { hasShownStartMessage: true });
    const result = evaluate(a1, A2, null, d("10:55"));
    expect(result?.ruleName).toBe("ending-continuation");
    expect(result?.type).toBeNull();
  });

  test("11:00 — welcome-continuation", () => {
    const a1 = withFlags(A1, { hasShownStartMessage: true, hasShownEndMessage: true });
    const result = evaluate(A2, null, a1, d("11:00"));
    expect(result?.ruleName).toBe("welcome-continuation");
    expect(result?.type).toBeNull();
  });

  test("11:25 — ending-free", () => {
    const a2 = withFlags(A2, { hasShownStartMessage: true });
    const result = evaluate(a2, null, null, d("11:25"));
    expect(result?.ruleName).toBe("ending-free");
    expect(result?.type).toBe("end-free");
  });
});

describe("Scenario 7: No bookings", () => {
  test("returns null", () => {
    const result = evaluate(null, null, null, d("10:00"));
    expect(result).toBeNull();
  });
});
