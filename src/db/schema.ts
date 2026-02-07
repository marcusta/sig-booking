import {
  customType,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { MatchiPlayer, MatchiWebhookJson } from "matchi_types";

// Custom type for boolean fields stored as integers
const booleanAsInteger = customType<{ data: boolean; driverData: number }>({
  dataType() {
    return "integer";
  },
  toDriver(value: boolean): number {
    return value ? 1 : 0;
  },
  fromDriver(value: number): boolean {
    return value === 1;
  },
});

export const bookings = sqliteTable("bookings", {
  bookingId: text("bookingId").primaryKey(),
  courtId: text("courtId").notNull(),
  courtName: text("courtName").notNull(),
  endTime: text("endTime").notNull(),
  splitPayment: booleanAsInteger("splitPayment").notNull().default(false),
  startTime: text("startTime").notNull(),
  customerId: text("customerId").notNull(),
  email: text("email").notNull(),
  userId: text("userId").notNull(),
  firstName: text("firstName").notNull(),
  lastName: text("lastName").notNull(),
  issuerId: text("issuerId").notNull(),
  players: text("players", {
    mode: "json",
  }).$type<MatchiPlayer[]>(),
  cancelled: booleanAsInteger("cancelled").notNull().default(false),
  hasShownStartMessage: booleanAsInteger("hasShownStartMessage")
    .notNull()
    .default(false),
  hasShownEndMessage: booleanAsInteger("hasShownEndMessage")
    .notNull()
    .default(false),
  isTest: booleanAsInteger("isTest").notNull().default(false),
}, (table) => ({
  bookingQueryIdx: index("booking_query_idx").on(table.courtId, table.startTime, table.endTime, table.cancelled),
}));

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export const bookingEvents = sqliteTable("booking_events", {
  matchiId: text("matchi_id").notNull(),
  matchiTimestamp: text("matchi_timestamp").notNull(),
  timestamp: text("timestamp").notNull(),
  bookingId: text("booking_id").notNull(),
  eventData: text("event_data", {
    mode: "json",
  }).$type<MatchiWebhookJson>(),
});

export type BookingEvent = typeof bookingEvents.$inferSelect;
export type NewBookingEvent = typeof bookingEvents.$inferInsert;

export const courseSuggestions = sqliteTable(
  "course_suggestions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: text("customerId").notNull(),
    level: text("level").notNull(),
    course: text("course").notNull(),
    suggestedAt: text("suggestedAt").notNull(),
  },
  (table) => ({
    customerLevelCourseIdx: index("course_suggestion_idx").on(
      table.customerId,
      table.level,
      table.course
    ),
  })
);

export type CourseSuggestion = typeof courseSuggestions.$inferSelect;
export type NewCourseSuggestion = typeof courseSuggestions.$inferInsert;
