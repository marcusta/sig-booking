import { getExactHourFromNow, isNearNewHour, toDateString } from "date";
import { db } from "db/db";
import { bookings, type Booking } from "db/schema";
import { and, eq, sql } from "drizzle-orm";

export interface UserMessage {
  type: "start" | "end-free" | "end-occupied";
  firstName: string;
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

export async function showUserMessageForCourt(
  courtId: string
): Promise<UserMessage | null> {
  const currentBooking = await getCurrentBooking(courtId);
  const nextBooking = await getNextBooking(courtId);
  const { isJustBefore } = isNearNewHour();

  if (!currentBooking && !nextBooking) {
    // console.log("No bookings for court");
    return null;
  }

  if (currentBooking && !currentBooking.hasShownStartMessage) {
    const previousBooking = await getPreviousBooking(courtId);
    // console.log("previousBooking", previousBooking);
    if (
      previousBooking &&
      previousBooking.customerId === currentBooking.customerId
    ) {
      await setHasShownStartMessage(currentBooking.bookingId);
      return null;
    }
    await setHasShownStartMessage(currentBooking.bookingId);
    return {
      type: "start",
      firstName: currentBooking.firstName,
    };
  }

  if (
    !currentBooking &&
    nextBooking &&
    !nextBooking.hasShownStartMessage &&
    isJustBefore
  ) {
    await setHasShownStartMessage(nextBooking.bookingId);
    return {
      type: "start",
      firstName: nextBooking.firstName,
    };
  }

  if (
    currentBooking &&
    currentBooking.hasShownStartMessage &&
    isJustBefore &&
    !currentBooking.hasShownEndMessage
  ) {
    if (!nextBooking) {
      await setHasShownEndMessage(currentBooking.bookingId);
      return {
        type: "end-free",
        firstName: currentBooking.firstName,
      };
    } else {
      await setHasShownEndMessage(currentBooking.bookingId);
      if (nextBooking.customerId === currentBooking.customerId) {
        return null;
      } else {
        return {
          type: "end-occupied",
          firstName: currentBooking.firstName,
        };
      }
    }
  }

  return null;
}

export async function getCurrentBooking(
  courtId: string
): Promise<Booking | null> {
  const currentHour = getExactHourFromNow(0);
  const nextHour = getExactHourFromNow(1);

  return first(
    await getActiveBookingsForCourt(courtId, currentHour, nextHour, 1)
  );
}

async function getActiveBookingsForCourt(
  courtId: string,
  startTimeDate: Date,
  endTimeDate: Date,
  limit?: number
): Promise<Booking[]> {
  const startTime = toDateString(startTimeDate);
  const endTime = toDateString(endTimeDate);

  try {
    let query = db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.courtId, courtId),
          sql`datetime(${bookings.startTime}) >= datetime(${startTime})`,
          sql`datetime(${bookings.endTime}) <= datetime(${endTime})`,
          eq(bookings.cancelled, false)
        )
      )
      .orderBy(bookings.startTime);

    if (limit) {
      query.limit(limit);
    }

    const rows = await query.all();
    return rows;
  } catch (e: any) {
    console.log("dbBookings.ts getActiveBookingsForCourt() error: ", e);
    throw e;
  }
}

export async function getNextBooking(courtId: string): Promise<Booking | null> {
  const nextHour = getExactHourFromNow(1);
  const twoHoursLater = getExactHourFromNow(2);
  return first(
    await getActiveBookingsForCourt(courtId, nextHour, twoHoursLater)
  );
}

export async function getPreviousBooking(
  courtId: string
): Promise<Booking | null> {
  const currentHour = getExactHourFromNow(0);
  const oneHourAgo = new Date(currentHour);
  oneHourAgo.setHours(oneHourAgo.getHours() - 1, 0, 0, 0);
  return first(
    await getActiveBookingsForCourt(courtId, oneHourAgo, currentHour)
  );
}

function first(bookings: Booking[]): Booking | null {
  return bookings[0] || null;
}
