import { toDateStringUTC } from "date";
import { db } from "db/db";
import { bookings, type Booking } from "db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import logger from "logger";

const NEAR_END_MINUTES = 5;
const NEAR_START_MINUTES = 5;
const LOOKAHEAD_MS = 2 * 60 * 60 * 1000;
const LOOKBACK_MS = 1 * 60 * 60 * 1000;

export interface UserMessage {
  type: "start" | "end-free" | "end-occupied";
  firstName: string;
  lastName: string;
  booking: Booking;
}

export interface MessageContext {
  current: Booking | null;
  next: Booking | null;
  previous: Booking | null;
  isNearEnd: boolean;
  isAboutToStart: boolean;
  nextIsConsecutive: boolean;
  sameCustomerAsPrevious: boolean;
  sameCustomerAsNext: boolean;
}

export type MessageType = "start" | "end-free" | "end-occupied";

export interface RuleResult {
  ruleName: string;
  type: MessageType | null;
  booking: Booking;
}

interface Rule {
  name: string;
  when: (ctx: MessageContext) => boolean;
  then: (ctx: MessageContext) => { type: MessageType | null; booking: Booking };
}

export const rules: Rule[] = [
  {
    name: "welcome",
    when: (ctx) =>
      ctx.current !== null &&
      !ctx.current.hasShownStartMessage &&
      !ctx.sameCustomerAsPrevious,
    then: (ctx) => ({ type: "start", booking: ctx.current! }),
  },
  {
    name: "welcome-continuation",
    when: (ctx) =>
      ctx.current !== null &&
      !ctx.current.hasShownStartMessage &&
      ctx.sameCustomerAsPrevious,
    then: (ctx) => ({ type: null, booking: ctx.current! }),
  },
  {
    name: "early-welcome",
    when: (ctx) =>
      ctx.current === null &&
      ctx.next !== null &&
      !ctx.next.hasShownStartMessage &&
      ctx.isAboutToStart,
    then: (ctx) => ({ type: "start", booking: ctx.next! }),
  },
  {
    name: "ending-free",
    when: (ctx) =>
      ctx.current !== null &&
      ctx.current.hasShownStartMessage &&
      !ctx.current.hasShownEndMessage &&
      ctx.isNearEnd &&
      !ctx.nextIsConsecutive,
    then: (ctx) => ({ type: "end-free", booking: ctx.current! }),
  },
  {
    name: "ending-occupied",
    when: (ctx) =>
      ctx.current !== null &&
      ctx.current.hasShownStartMessage &&
      !ctx.current.hasShownEndMessage &&
      ctx.isNearEnd &&
      ctx.nextIsConsecutive &&
      !ctx.sameCustomerAsNext,
    then: (ctx) => ({ type: "end-occupied", booking: ctx.current! }),
  },
  {
    name: "ending-continuation",
    when: (ctx) =>
      ctx.current !== null &&
      ctx.current.hasShownStartMessage &&
      !ctx.current.hasShownEndMessage &&
      ctx.isNearEnd &&
      ctx.nextIsConsecutive &&
      ctx.sameCustomerAsNext,
    then: (ctx) => ({ type: null, booking: ctx.current! }),
  },
];

export function buildContext(
  current: Booking | null,
  next: Booking | null,
  previous: Booking | null,
  now: Date
): MessageContext {
  const msUntilEnd = current
    ? new Date(current.endTime).getTime() - now.getTime()
    : Infinity;
  const msUntilStart = next
    ? new Date(next.startTime).getTime() - now.getTime()
    : Infinity;

  const isNearEnd = msUntilEnd >= 0 && msUntilEnd <= NEAR_END_MINUTES * 60_000;
  const isAboutToStart =
    msUntilStart >= 0 && msUntilStart <= NEAR_START_MINUTES * 60_000;

  const nextIsConsecutive =
    current !== null &&
    next !== null &&
    current.endTime === next.startTime;

  const sameCustomerAsPrevious =
    current !== null &&
    previous !== null &&
    current.customerId === previous.customerId;

  const sameCustomerAsNext =
    current !== null &&
    next !== null &&
    current.customerId === next.customerId;

  return {
    current,
    next,
    previous,
    isNearEnd,
    isAboutToStart,
    nextIsConsecutive,
    sameCustomerAsPrevious,
    sameCustomerAsNext,
  };
}

export function evaluateRules(ctx: MessageContext): RuleResult | null {
  for (const rule of rules) {
    if (rule.when(ctx)) {
      const result = rule.then(ctx);
      return { ruleName: rule.name, type: result.type, booking: result.booking };
    }
  }
  return null;
}

export async function showUserMessageForCourt(
  courtId: string,
  options: { forceCurrent?: boolean } = {}
): Promise<UserMessage | null> {
  try {
    const now = new Date();
    const current = await getCurrentBooking(courtId, now);
    const next = await getNextBooking(courtId, now);

    if (options.forceCurrent) {
      if (!current) {
        logger.info("showUserMessageForCourt: No current booking for court");
        return null;
      }
      return toUserMessage("start", current);
    }

    if (!current && !next) {
      logger.info("showUserMessageForCourt: No bookings for court");
      return null;
    }

    const previous =
      current && !current.hasShownStartMessage
        ? await getPreviousBooking(courtId, now)
        : null;

    const ctx = buildContext(current, next, previous, now);

    logger.debug(
      "showUserMessageForCourt context: " +
        JSON.stringify({
          current: current?.bookingId,
          next: next?.bookingId,
          previous: previous?.bookingId,
          isNearEnd: ctx.isNearEnd,
          isAboutToStart: ctx.isAboutToStart,
          nextIsConsecutive: ctx.nextIsConsecutive,
          sameCustomerAsPrevious: ctx.sameCustomerAsPrevious,
          sameCustomerAsNext: ctx.sameCustomerAsNext,
        })
    );

    const result = evaluateRules(ctx);
    if (!result) return null;

    logger.info(`Rule matched: ${result.ruleName} for court ${courtId}`);
    await applyFlags(result.ruleName, result.booking);
    if (result.type === null) return null;
    return toUserMessage(result.type, result.booking);
  } catch (error) {
    logger.error("Error showing user message: ", error);
    return null;
  }
}

async function applyFlags(ruleName: string, booking: Booking) {
  if (ruleName.startsWith("welcome") || ruleName === "early-welcome") {
    await setHasShownStartMessage(booking.bookingId);
  }
  if (ruleName.startsWith("ending")) {
    await setHasShownEndMessage(booking.bookingId);
  }
}

function toUserMessage(
  type: "start" | "end-free" | "end-occupied",
  booking: Booking
): UserMessage {
  return {
    type,
    firstName: booking.firstName,
    lastName: booking.lastName,
    booking,
  };
}

async function setHasShownStartMessage(bookingId: string) {
  await db
    .update(bookings)
    .set({ hasShownStartMessage: true })
    .where(eq(bookings.bookingId, bookingId));
}

async function setHasShownEndMessage(bookingId: string) {
  await db
    .update(bookings)
    .set({ hasShownEndMessage: true })
    .where(eq(bookings.bookingId, bookingId));
}

// --- Query functions ---

export async function getCurrentBooking(
  courtId: string,
  now: Date = new Date()
): Promise<Booking | null> {
  const nowStr = toDateStringUTC(now);
  const rows = await db
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

export async function getNextBooking(
  courtId: string,
  now: Date = new Date()
): Promise<Booking | null> {
  const nowStr = toDateStringUTC(now);
  const limitStr = toDateStringUTC(new Date(now.getTime() + LOOKAHEAD_MS));
  const rows = await db
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

export async function getPreviousBooking(
  courtId: string,
  now: Date = new Date()
): Promise<Booking | null> {
  const nowStr = toDateStringUTC(now);
  const limitStr = toDateStringUTC(new Date(now.getTime() - LOOKBACK_MS));
  const rows = await db
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
