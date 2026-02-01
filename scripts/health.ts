import { Database } from "bun:sqlite";

const dbPath = process.env.DB_PATH || "data/matchi.db";
console.log(`Validating database schema at ${dbPath}...`);

const db = new Database(dbPath);

try {
  db.query("SELECT 1").get();

  const tables = db.query(
    "SELECT name FROM sqlite_master WHERE type='table'"
  ).all() as { name: string }[];

  const tableNames = tables.map(t => t.name);
  const requiredTables = ["bookings", "booking_events"];

  for (const table of requiredTables) {
    if (!tableNames.includes(table)) {
      throw new Error(`Missing required table: ${table}`);
    }
  }

  // Verify key columns on bookings table
  const bookingColumns = db.query("PRAGMA table_info(bookings)").all() as { name: string }[];
  const bookingColumnNames = bookingColumns.map(c => c.name);
  const requiredBookingColumns = [
    "bookingId", "courtId", "courtName", "startTime", "endTime",
    "customerId", "email", "firstName", "lastName", "cancelled",
  ];

  for (const col of requiredBookingColumns) {
    if (!bookingColumnNames.includes(col)) {
      throw new Error(`Missing column in bookings: ${col}`);
    }
  }

  // Verify key columns on booking_events table
  const eventColumns = db.query("PRAGMA table_info(booking_events)").all() as { name: string }[];
  const eventColumnNames = eventColumns.map(c => c.name);
  const requiredEventColumns = ["matchi_id", "matchi_timestamp", "timestamp", "booking_id", "event_data"];

  for (const col of requiredEventColumns) {
    if (!eventColumnNames.includes(col)) {
      throw new Error(`Missing column in booking_events: ${col}`);
    }
  }

  console.log("Database validation passed");
  db.close();
  process.exit(0);
} catch (error) {
  console.error("Validation failed:", error);
  db.close();
  process.exit(1);
}
