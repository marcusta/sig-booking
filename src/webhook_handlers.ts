import { db } from "db/db";
import { bookingEvents, bookings, type NewBooking } from "db/schema";
import { eq } from "drizzle-orm";
import type { CreatedBookingObject, MatchiWebhookJson } from "matchi_types";

export function handleWebhook(json: MatchiWebhookJson): void {
  const handler = matchiHandlers[json["detail-type"]];
  logMatchiWebhook(json);
  if (handler) {
    return handler(json);
  } else {
    console.log("No handler for " + json["detail-type"]);
    throw { status: 400, message: "No handler for " + json["detail-type"] };
  }
}

interface MatchiHandler {
  (matchiWebhookJson: MatchiWebhookJson): void;
}

const matchiHandlers: {
  [key: string]: MatchiHandler;
} = {
  BookingCreatedV1: createdBooking,
  BookingCreated: createdBooking,
  BookingMoved: movedBooking,
  BookingMovedV1: movedBooking,
  BookingCancelled: cancelledBooking,
  BookingCancelledV1: cancelledBooking,
};

async function createdBooking(bookingJson: MatchiWebhookJson) {
  console.log(
    "timestamp: " + bookingJson.timestamp + " eventId: " + bookingJson.id
  );

  const { booking, owner, players } =
    bookingJson.detail as CreatedBookingObject;

  const bookingToStore: NewBooking = {
    bookingId: booking.bookingId,
    courtId: booking.courtId,
    courtName: booking.courtName,
    endTime: booking.endTime,
    splitPayment: booking.splitPayment,
    startTime: booking.startTime,
    customerId: owner.customerId,
    email: owner.email,
    userId: owner.userId,
    firstName: owner.firstName,
    lastName: owner.lastName,
    issuerId: "hardcoded-issuer-id",
    players: players.map((p) => p.email).join(", "),
    cancelled: false,
    hasShownStartMessage: false,
    hasShownEndMessage: false,
  };

  let insertError;
  try {
    await db
      .insert(bookings)
      .values(bookingToStore)
      .onConflictDoUpdate({
        target: [bookings.bookingId],
        set: bookingToStore,
      });
  } catch (e: any) {
    if (e.status === 409) {
      console.log(
        "matchi.ts createdBooking: Booking already exists: " + booking.bookingId
      );
    } else {
      console.log("matchi.ts createdBooking: SQL error: " + e.message);
    }
  }

  try {
    await db.insert(bookingEvents).values({
      matchiId: bookingJson.id,
      matchiTimestamp: bookingJson.timestamp,
      bookingId: booking.bookingId,
      timestamp: bookingJson.timestamp,
      eventData: bookingJson,
    });
  } catch (e: any) {
    console.log("matchi.ts createdBooking: SQL error: " + e.message);
  }
  if (insertError) {
    throw insertError;
  }
}

async function movedBooking(bookingJson: MatchiWebhookJson) {
  const booking = (bookingJson.detail as CreatedBookingObject).booking;
  const { bookingId, courtId, courtName, startTime, endTime } = booking;
  let moveError;
  try {
    await db
      .update(bookings)
      .set({
        courtId,
        courtName,
        startTime,
        endTime,
      })
      .where(eq(bookings.bookingId, bookingId));
  } catch (e: any) {
    moveError = e;
    console.log("matchi.ts movedBooking: SQL error: ", e);
  }

  try {
    await db.insert(bookingEvents).values({
      matchiId: bookingJson.id,
      matchiTimestamp: bookingJson.timestamp,
      bookingId,
      timestamp: bookingJson.timestamp,
      eventData: bookingJson,
    });
  } catch (e: any) {
    console.log("matchi.ts movedBooking store event: SQL error: ", e);
  }

  if (moveError) {
    throw moveError;
  }
}

async function cancelledBooking(bookingJson: MatchiWebhookJson) {
  const { booking } = bookingJson.detail;
  const bookingId = booking.bookingId;
  console.log("cancelling booking " + bookingId);
  let cancelError;
  try {
    await db
      .update(bookings)
      .set({ cancelled: true })
      .where(eq(bookings.bookingId, bookingId));
    console.log("cancelled booking " + bookingId);
  } catch (e: any) {
    cancelError = e;
    console.log("matchi.ts cancelledBooking: SQL error: ", e);
  }

  try {
    await db.insert(bookingEvents).values({
      matchiId: bookingJson.id,
      matchiTimestamp: bookingJson.timestamp,
      bookingId,
      timestamp: bookingJson.timestamp,
      eventData: bookingJson,
    });
  } catch (e: any) {
    console.log("matchi.ts cancelledBooking store event: SQL error: ", e);
  }
  if (cancelError) {
    throw cancelError;
  }
}

function logMatchiWebhook(json: MatchiWebhookJson) {
  const logParts: string[] = [];
  const missingProps: string[] = [];

  // Helper function to add log entry
  const addLogEntry = (label: string, value: any, path: string) => {
    if (value !== undefined) {
      logParts.push(`${label}: ${value}`);
    } else {
      missingProps.push(path);
    }
  };
}
