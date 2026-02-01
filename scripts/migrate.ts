import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const dbPath = process.env.DB_PATH || "data/matchi.db";
console.log(`Running migrations on ${dbPath}...`);

const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

try {
  // Check if the initial migration has already been recorded
  const hasJournal = sqlite.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
  ).get();

  const hasBookings = sqlite.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='bookings'"
  ).get();

  // Tables exist but Drizzle doesn't know — baseline the initial migration
  if (hasBookings) {
    if (!hasJournal) {
      // Create the journal table matching Drizzle's own schema
      sqlite.run(`
        CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at numeric
        )
      `);
    }

    const alreadyBaselined = sqlite.query(
      "SELECT id FROM __drizzle_migrations WHERE hash = ?"
    ).get("0000_noisy_prowler");

    if (!alreadyBaselined) {
      console.log("Baselining existing database into Drizzle migration journal...");
      sqlite.run(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        "0000_noisy_prowler", 1729577366065
      );
    }
  }

  migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations completed successfully");
  sqlite.close();
  process.exit(0);
} catch (error) {
  console.error("Migration failed:", error);
  sqlite.close();
  process.exit(1);
}
