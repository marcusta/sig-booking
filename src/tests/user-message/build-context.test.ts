import { describe, test, expect } from "bun:test";
import { buildContext } from "../../user_message";
import { makeBooking, t, d } from "./helpers";

describe("buildContext", () => {
  describe("isNearEnd", () => {
    test("true when 5 minutes before current booking ends", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const ctx = buildContext(current, null, null, d("10:25"));
      expect(ctx.isNearEnd).toBe(true);
    });

    test("true when exactly 5 minutes before end", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const ctx = buildContext(current, null, null, d("10:25"));
      expect(ctx.isNearEnd).toBe(true);
    });

    test("false when 6 minutes before end", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const ctx = buildContext(current, null, null, d("10:24"));
      expect(ctx.isNearEnd).toBe(false);
    });

    test("true at exact end time (0 ms remaining)", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const ctx = buildContext(current, null, null, d("10:30"));
      expect(ctx.isNearEnd).toBe(true);
    });

    test("false when no current booking", () => {
      const ctx = buildContext(null, null, null, d("10:25"));
      expect(ctx.isNearEnd).toBe(false);
    });

    test("false mid-session (15 minutes before end)", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const ctx = buildContext(current, null, null, d("10:15"));
      expect(ctx.isNearEnd).toBe(false);
    });

    test("works with 60-minute bookings", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("11:00"), customerId: "A" });
      const ctx = buildContext(current, null, null, d("10:55"));
      expect(ctx.isNearEnd).toBe(true);
    });

    test("works with 60-minute bookings mid-session", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("11:00"), customerId: "A" });
      const ctx = buildContext(current, null, null, d("10:30"));
      expect(ctx.isNearEnd).toBe(false);
    });
  });

  describe("isAboutToStart", () => {
    test("true when 3 minutes before next booking starts", () => {
      const next = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const ctx = buildContext(null, next, null, d("09:57"));
      expect(ctx.isAboutToStart).toBe(true);
    });

    test("true when exactly 5 minutes before start", () => {
      const next = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const ctx = buildContext(null, next, null, d("09:55"));
      expect(ctx.isAboutToStart).toBe(true);
    });

    test("false when 6 minutes before start", () => {
      const next = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const ctx = buildContext(null, next, null, d("09:54"));
      expect(ctx.isAboutToStart).toBe(false);
    });

    test("false when no next booking", () => {
      const ctx = buildContext(null, null, null, d("09:57"));
      expect(ctx.isAboutToStart).toBe(false);
    });

    test("false when next booking is 30 minutes away", () => {
      const next = makeBooking({ startTime: t("11:00"), endTime: t("11:30"), customerId: "A" });
      const ctx = buildContext(null, next, null, d("10:30"));
      expect(ctx.isAboutToStart).toBe(false);
    });
  });

  describe("nextIsConsecutive", () => {
    test("true when next starts exactly at current end", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const next = makeBooking({ startTime: t("10:30"), endTime: t("11:00"), customerId: "B" });
      const ctx = buildContext(current, next, null, d("10:15"));
      expect(ctx.nextIsConsecutive).toBe(true);
    });

    test("false when there is a gap", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const next = makeBooking({ startTime: t("11:00"), endTime: t("11:30"), customerId: "B" });
      const ctx = buildContext(current, next, null, d("10:15"));
      expect(ctx.nextIsConsecutive).toBe(false);
    });

    test("false when no current booking", () => {
      const next = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const ctx = buildContext(null, next, null, d("09:55"));
      expect(ctx.nextIsConsecutive).toBe(false);
    });

    test("false when no next booking", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const ctx = buildContext(current, null, null, d("10:15"));
      expect(ctx.nextIsConsecutive).toBe(false);
    });
  });

  describe("sameCustomerAsPrevious", () => {
    test("true when current and previous have same customerId", () => {
      const previous = makeBooking({ startTime: t("09:30"), endTime: t("10:00"), customerId: "A" });
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const ctx = buildContext(current, null, previous, d("10:00"));
      expect(ctx.sameCustomerAsPrevious).toBe(true);
    });

    test("false when different customers", () => {
      const previous = makeBooking({ startTime: t("09:30"), endTime: t("10:00"), customerId: "A" });
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "B" });
      const ctx = buildContext(current, null, previous, d("10:00"));
      expect(ctx.sameCustomerAsPrevious).toBe(false);
    });

    test("false when no previous booking", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const ctx = buildContext(current, null, null, d("10:00"));
      expect(ctx.sameCustomerAsPrevious).toBe(false);
    });

    test("false when no current booking", () => {
      const previous = makeBooking({ startTime: t("09:30"), endTime: t("10:00"), customerId: "A" });
      const ctx = buildContext(null, null, previous, d("10:00"));
      expect(ctx.sameCustomerAsPrevious).toBe(false);
    });
  });

  describe("sameCustomerAsNext", () => {
    test("true when current and next have same customerId", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const next = makeBooking({ startTime: t("10:30"), endTime: t("11:00"), customerId: "A" });
      const ctx = buildContext(current, next, null, d("10:15"));
      expect(ctx.sameCustomerAsNext).toBe(true);
    });

    test("false when different customers", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const next = makeBooking({ startTime: t("10:30"), endTime: t("11:00"), customerId: "B" });
      const ctx = buildContext(current, next, null, d("10:15"));
      expect(ctx.sameCustomerAsNext).toBe(false);
    });

    test("false when no next booking", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const ctx = buildContext(current, null, null, d("10:15"));
      expect(ctx.sameCustomerAsNext).toBe(false);
    });
  });
});
