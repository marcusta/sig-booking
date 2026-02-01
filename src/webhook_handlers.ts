import { db } from "db/db";
import { bookingEvents, bookings, type NewBooking } from "db/schema";
import { eq } from "drizzle-orm";
import type { CreatedBookingObject, MatchiWebhookJson } from "matchi_types";
import logger from "./logger";

export async function handleWebhook(json: MatchiWebhookJson): Promise<void> {
  const handler = matchiHandlers[json["detail-type"]];
  try {
    logMatchiWebhook(json);
  } catch (e) {
    logger.error("error logging logMatchiWebhook: " + e);
  }
  if (handler) {
    await handler(json);
  } else {
    logger.error("No handler for " + json["detail-type"]);
  }
}

interface MatchiHandler {
  (matchiWebhookJson: MatchiWebhookJson): Promise<void>;
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
  logger.info(
    "createdBooking timestamp: " +
      bookingJson.timestamp +
      " eventId: " +
      bookingJson.id
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
    players: players.map((p) => ({
      email: p.email,
      userId: p.userId,
      isCustomer: p.isCustomer,
    })),
    cancelled: false,
    hasShownStartMessage: false,
    hasShownEndMessage: false,
  };

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(bookings)
        .values(bookingToStore)
        .onConflictDoUpdate({
          target: [bookings.bookingId],
          set: {
            courtId: bookingToStore.courtId,
            courtName: bookingToStore.courtName,
            endTime: bookingToStore.endTime,
            splitPayment: bookingToStore.splitPayment,
            startTime: bookingToStore.startTime,
            customerId: bookingToStore.customerId,
            email: bookingToStore.email,
            userId: bookingToStore.userId,
            firstName: bookingToStore.firstName,
            lastName: bookingToStore.lastName,
            issuerId: bookingToStore.issuerId,
            players: bookingToStore.players,
            cancelled: bookingToStore.cancelled,
          },
        });

      await tx.insert(bookingEvents).values({
        matchiId: bookingJson.id,
        matchiTimestamp: bookingJson.timestamp,
        bookingId: booking.bookingId,
        timestamp: bookingJson.timestamp,
        eventData: bookingJson,
      });
    });
  } catch (e: any) {
    if (e.status === 409) {
      logger.info(
        "matchi.ts createdBooking: Booking already exists: " + booking.bookingId
      );
    } else {
      logger.error("matchi.ts createdBooking: SQL error: " + e.message);
    }
    throw e;
  }
}

async function movedBooking(bookingJson: MatchiWebhookJson) {
  const booking = (bookingJson.detail as CreatedBookingObject).booking;
  const { bookingId, courtId, courtName, startTime, endTime } = booking;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({
          courtId,
          courtName,
          startTime,
          endTime,
        })
        .where(eq(bookings.bookingId, bookingId));

      await tx.insert(bookingEvents).values({
        matchiId: bookingJson.id,
        matchiTimestamp: bookingJson.timestamp,
        bookingId,
        timestamp: bookingJson.timestamp,
        eventData: bookingJson,
      });
    });
  } catch (e: any) {
    logger.error("matchi.ts movedBooking: SQL error: ", e);
    throw e;
  }
}

async function cancelledBooking(bookingJson: MatchiWebhookJson) {
  const { booking } = bookingJson.detail;
  const bookingId = booking.bookingId;
  logger.info("cancelling booking " + bookingId);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({ cancelled: true })
        .where(eq(bookings.bookingId, bookingId));

      await tx.insert(bookingEvents).values({
        matchiId: bookingJson.id,
        matchiTimestamp: bookingJson.timestamp,
        bookingId,
        timestamp: bookingJson.timestamp,
        eventData: bookingJson,
      });
    });
    logger.info("cancelled booking " + bookingId);
  } catch (e: any) {
    logger.error("matchi.ts cancelledBooking: SQL error: ", e);
    throw e;
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

  addLogEntry("matchiId", json.id, "json");
  addLogEntry("timestamp", json.timestamp, "json");
  addLogEntry("detail-type", json["detail-type"], "json");
  addLogEntry("detail", JSON.stringify(json.detail), "json");

  logger.info("logMatchiWebhook: " + logParts.join(", "));
}
