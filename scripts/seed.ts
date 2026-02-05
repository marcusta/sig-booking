import { randomUUID } from "crypto";
import { db } from "../src/db/db";
import { bookings } from "../src/db/schema";
import { MATCHI_COURT_IDS } from "../src/courts";
import { getExactHourFromNow, toDateStringUTC } from "../src/date";

const scenario = process.env.SEED_SCENARIO || "default";
const courtId = process.env.SEED_COURT_ID || MATCHI_COURT_IDS.BAY_1;

async function seedShowMessageScenario() {
  const startTime = getExactHourFromNow(0);
  const endTime = getExactHourFromNow(1);
  const bookingId = `seed-${randomUUID()}`;

  await db.insert(bookings).values({
    bookingId,
    courtId,
    courtName: "Seed Court",
    endTime: toDateStringUTC(endTime),
    splitPayment: false,
    startTime: toDateStringUTC(startTime),
    customerId: "seed-customer-1",
    email: "seed@example.com",
    userId: "seed-user-1",
    firstName: "Marcus",
    lastName: "Test",
    issuerId: "seed-issuer-1",
    players: [],
    cancelled: false,
    hasShownStartMessage: false,
    hasShownEndMessage: false,
  });

  console.log(
    `Seeded booking ${bookingId} for court ${courtId} starting ${startTime.toISOString()}`
  );
}

async function seedDefaultScenario() {
  console.log("No seed scenario selected. Set SEED_SCENARIO=show-message.");
}

async function main() {
  if (scenario === "show-message") {
    await seedShowMessageScenario();
    return;
  }

  await seedDefaultScenario();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
