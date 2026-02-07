import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { bookings, type Booking, type NewBooking } from "../../db/schema";
import * as schema from "../../db/schema";

let counter = 0;

interface BookingInput {
  courtId?: string;
  startTime: string;
  endTime: string;
  customerId?: string;
  firstName?: string;
  lastName?: string;
  hasShownStartMessage?: boolean;
  hasShownEndMessage?: boolean;
  cancelled?: boolean;
}

export function makeBooking(input: BookingInput): Booking {
  counter++;
  return {
    bookingId: `booking-${counter}`,
    courtId: input.courtId ?? "2068",
    courtName: "Bay 1",
    startTime: input.startTime,
    endTime: input.endTime,
    customerId: input.customerId ?? `customer-${counter}`,
    email: "test@test.com",
    userId: "user-1",
    firstName: input.firstName ?? "Test",
    lastName: input.lastName ?? "User",
    issuerId: "issuer-1",
    players: null,
    splitPayment: false,
    cancelled: input.cancelled ?? false,
    hasShownStartMessage: input.hasShownStartMessage ?? false,
    hasShownEndMessage: input.hasShownEndMessage ?? false,
    isTest: true,
  };
}

export function createTestDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./src/db/migrations" });
  return db;
}

export type TestDb = ReturnType<typeof createTestDb>;

export async function insertBooking(db: TestDb, booking: Booking) {
  await db.insert(bookings).values(booking as NewBooking);
}

export function t(time: string): string {
  return `2025-06-15T${time}:00Z`;
}

export function d(time: string): Date {
  return new Date(t(time));
}
