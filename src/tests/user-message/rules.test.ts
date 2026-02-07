import { describe, test, expect } from "bun:test";
import { evaluateRules, type MessageContext } from "../../user_message";
import { makeBooking, t } from "./helpers";

function ctx(overrides: Partial<MessageContext> = {}): MessageContext {
  return {
    current: null,
    next: null,
    previous: null,
    isNearEnd: false,
    isAboutToStart: false,
    nextIsConsecutive: false,
    sameCustomerAsPrevious: false,
    sameCustomerAsNext: false,
    ...overrides,
  };
}

describe("evaluateRules", () => {
  describe("welcome", () => {
    test("fires for new customer with current booking", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const result = evaluateRules(ctx({ current }));
      expect(result?.ruleName).toBe("welcome");
      expect(result?.type).toBe("start");
      expect(result?.booking).toBe(current);
    });

    test("does not fire if hasShownStartMessage is true", () => {
      const current = makeBooking({
        startTime: t("10:00"), endTime: t("10:30"), customerId: "A",
        hasShownStartMessage: true,
      });
      const result = evaluateRules(ctx({ current }));
      expect(result?.ruleName).not.toBe("welcome");
    });

    test("does not fire if same customer as previous (welcome-continuation wins)", () => {
      const current = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const result = evaluateRules(ctx({ current, sameCustomerAsPrevious: true }));
      expect(result?.ruleName).toBe("welcome-continuation");
    });
  });

  describe("welcome-continuation", () => {
    test("fires for continuation booking (same customer as previous)", () => {
      const current = makeBooking({ startTime: t("10:30"), endTime: t("11:00"), customerId: "A" });
      const result = evaluateRules(ctx({ current, sameCustomerAsPrevious: true }));
      expect(result?.ruleName).toBe("welcome-continuation");
      expect(result?.type).toBeNull();
      expect(result?.booking).toBe(current);
    });
  });

  describe("early-welcome", () => {
    test("fires when no current booking and next is about to start", () => {
      const next = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const result = evaluateRules(ctx({ next, isAboutToStart: true }));
      expect(result?.ruleName).toBe("early-welcome");
      expect(result?.type).toBe("start");
      expect(result?.booking).toBe(next);
    });

    test("does not fire if next already has start message shown", () => {
      const next = makeBooking({
        startTime: t("10:00"), endTime: t("10:30"), customerId: "A",
        hasShownStartMessage: true,
      });
      const result = evaluateRules(ctx({ next, isAboutToStart: true }));
      expect(result).toBeNull();
    });

    test("does not fire if not about to start", () => {
      const next = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const result = evaluateRules(ctx({ next, isAboutToStart: false }));
      expect(result).toBeNull();
    });

    test("does not fire if current booking exists", () => {
      const current = makeBooking({
        startTime: t("09:30"), endTime: t("10:00"), customerId: "B",
        hasShownStartMessage: true, hasShownEndMessage: true,
      });
      const next = makeBooking({ startTime: t("10:00"), endTime: t("10:30"), customerId: "A" });
      const result = evaluateRules(ctx({ current, next, isAboutToStart: true }));
      expect(result).toBeNull();
    });
  });

  describe("ending-free", () => {
    test("fires when near end with no consecutive next booking", () => {
      const current = makeBooking({
        startTime: t("10:00"), endTime: t("10:30"), customerId: "A",
        hasShownStartMessage: true,
      });
      const result = evaluateRules(ctx({ current, isNearEnd: true }));
      expect(result?.ruleName).toBe("ending-free");
      expect(result?.type).toBe("end-free");
    });

    test("fires when next booking exists but is not consecutive (gap)", () => {
      const current = makeBooking({
        startTime: t("10:00"), endTime: t("10:30"), customerId: "A",
        hasShownStartMessage: true,
      });
      const next = makeBooking({ startTime: t("11:00"), endTime: t("11:30"), customerId: "B" });
      const result = evaluateRules(ctx({
        current, next, isNearEnd: true, nextIsConsecutive: false,
      }));
      expect(result?.ruleName).toBe("ending-free");
    });

    test("does not fire if not near end", () => {
      const current = makeBooking({
        startTime: t("10:00"), endTime: t("10:30"), customerId: "A",
        hasShownStartMessage: true,
      });
      const result = evaluateRules(ctx({ current, isNearEnd: false }));
      expect(result).toBeNull();
    });

    test("does not fire if end message already shown", () => {
      const current = makeBooking({
        startTime: t("10:00"), endTime: t("10:30"), customerId: "A",
        hasShownStartMessage: true, hasShownEndMessage: true,
      });
      const result = evaluateRules(ctx({ current, isNearEnd: true }));
      expect(result).toBeNull();
    });

    test("does not fire if start message not yet shown", () => {
      const current = makeBooking({
        startTime: t("10:00"), endTime: t("10:30"), customerId: "A",
        hasShownStartMessage: false,
      });
      const result = evaluateRules(ctx({ current, isNearEnd: true }));
      // welcome rule fires instead
      expect(result?.ruleName).toBe("welcome");
    });
  });

  describe("ending-occupied", () => {
    test("fires when near end with consecutive next booking by different customer", () => {
      const current = makeBooking({
        startTime: t("10:00"), endTime: t("10:30"), customerId: "A",
        hasShownStartMessage: true,
      });
      const next = makeBooking({ startTime: t("10:30"), endTime: t("11:00"), customerId: "B" });
      const result = evaluateRules(ctx({
        current, next, isNearEnd: true, nextIsConsecutive: true, sameCustomerAsNext: false,
      }));
      expect(result?.ruleName).toBe("ending-occupied");
      expect(result?.type).toBe("end-occupied");
    });

    test("does not fire when next is same customer (ending-continuation wins)", () => {
      const current = makeBooking({
        startTime: t("10:00"), endTime: t("10:30"), customerId: "A",
        hasShownStartMessage: true,
      });
      const next = makeBooking({ startTime: t("10:30"), endTime: t("11:00"), customerId: "A" });
      const result = evaluateRules(ctx({
        current, next, isNearEnd: true, nextIsConsecutive: true, sameCustomerAsNext: true,
      }));
      expect(result?.ruleName).toBe("ending-continuation");
    });
  });

  describe("ending-continuation", () => {
    test("fires when near end with consecutive next booking by same customer", () => {
      const current = makeBooking({
        startTime: t("10:00"), endTime: t("10:30"), customerId: "A",
        hasShownStartMessage: true,
      });
      const next = makeBooking({ startTime: t("10:30"), endTime: t("11:00"), customerId: "A" });
      const result = evaluateRules(ctx({
        current, next, isNearEnd: true, nextIsConsecutive: true, sameCustomerAsNext: true,
      }));
      expect(result?.ruleName).toBe("ending-continuation");
      expect(result?.type).toBeNull();
    });
  });

  describe("no rule matches", () => {
    test("returns null when no bookings", () => {
      const result = evaluateRules(ctx());
      expect(result).toBeNull();
    });

    test("returns null mid-session (start shown, not near end)", () => {
      const current = makeBooking({
        startTime: t("10:00"), endTime: t("10:30"), customerId: "A",
        hasShownStartMessage: true,
      });
      const result = evaluateRules(ctx({ current }));
      expect(result).toBeNull();
    });

    test("returns null when all messages already shown", () => {
      const current = makeBooking({
        startTime: t("10:00"), endTime: t("10:30"), customerId: "A",
        hasShownStartMessage: true, hasShownEndMessage: true,
      });
      const result = evaluateRules(ctx({ current, isNearEnd: true }));
      expect(result).toBeNull();
    });
  });
});
