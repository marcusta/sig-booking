import { eq, and } from "drizzle-orm";
import { Elysia } from "elysia";
import { readFileSync } from "fs";
import type { MatchiWebhookJson } from "matchi_types";
import { getMonthlyBookingSummary } from "services/booking_analysis";
import {
  getCourseSuggestionForCustomer,
  getSkillLevelForCustomer,
} from "services/course_suggestions";
import { generateBookingSummaryHTML } from "services/html_generator";
import { showUserMessageForCourt } from "user_message";
import { handleWebhook } from "webhook_handlers";
import { BAY_TO_COURT, VALID_MATCHI_COURT_IDS } from "./courts";
import { db } from "./db/db";
import { bookings } from "./db/schema";
import { addTextToImage } from "./image/image-generator";
import logger from "./logger";

const secureCookie = process.env.NODE_ENV === "production" ? "; Secure" : "";
import {
  createSessionToken,
  validateCredentials,
  verifySessionToken,
} from "./middleware/auth";

const routes = new Elysia()

  // Home route
  .get("/", () => ({
    message: "Welcome to the SIG Matchi webhook server!",
  }))

  // Test endpoints for booking manipulation
  .post(
    "/test/courts/:matchiCourtId/bookings",
    async ({ params: { matchiCourtId }, body, set }) => {
      if (!isValidMatchiCourtId(matchiCourtId)) {
        set.status = 404;
        return { error: "Invalid court ID" };
      }
      const b = (body || {}) as Record<string, any>;
      const now = new Date();
      const startTime = b.startTime || new Date(now.getTime() + 5 * 60_000).toISOString();
      const endTime = b.endTime || new Date(new Date(startTime).getTime() + 60 * 60_000).toISOString();
      const bookingId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const newBooking = {
        bookingId,
        courtId: matchiCourtId,
        courtName: `Test Bay`,
        startTime,
        endTime,
        splitPayment: false,
        customerId: `test-customer-${Date.now()}`,
        email: "test@test.com",
        userId: "test-user",
        firstName: b.firstName || "Test",
        lastName: b.lastName || "Testsson",
        issuerId: "test-issuer",
        players: [],
        cancelled: false,
        hasShownStartMessage: b.hasShownStartMessage ?? false,
        hasShownEndMessage: b.hasShownEndMessage ?? false,
        isTest: true,
      };

      await db.insert(bookings).values(newBooking);
      set.status = 201;
      return newBooking;
    }
  )

  .get(
    "/test/courts/:matchiCourtId/bookings",
    async ({ params: { matchiCourtId }, set }) => {
      if (!isValidMatchiCourtId(matchiCourtId)) {
        set.status = 404;
        return { error: "Invalid court ID" };
      }
      const results = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.courtId, matchiCourtId), eq(bookings.isTest, true)));
      return results;
    }
  )

  .delete(
    "/test/courts/:matchiCourtId/bookings",
    async ({ params: { matchiCourtId }, set }) => {
      if (!isValidMatchiCourtId(matchiCourtId)) {
        set.status = 404;
        return { error: "Invalid court ID" };
      }
      const result = await db
        .delete(bookings)
        .where(and(eq(bookings.courtId, matchiCourtId), eq(bookings.isTest, true)));
      return { deleted: result.changes };
    }
  )

  .patch(
    "/test/bookings/:bookingId",
    async ({ params: { bookingId }, body, set }) => {
      const existing = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.bookingId, bookingId), eq(bookings.isTest, true)));
      if (existing.length === 0) {
        set.status = 404;
        return { error: "Test booking not found" };
      }
      const b = (body || {}) as Record<string, any>;
      const updates: Record<string, any> = {};
      if (b.firstName !== undefined) updates.firstName = b.firstName;
      if (b.lastName !== undefined) updates.lastName = b.lastName;
      if (b.startTime !== undefined) updates.startTime = b.startTime;
      if (b.endTime !== undefined) updates.endTime = b.endTime;
      if (b.hasShownStartMessage !== undefined) updates.hasShownStartMessage = b.hasShownStartMessage;
      if (b.hasShownEndMessage !== undefined) updates.hasShownEndMessage = b.hasShownEndMessage;
      if (b.cancelled !== undefined) updates.cancelled = b.cancelled;

      if (Object.keys(updates).length > 0) {
        await db.update(bookings).set(updates).where(eq(bookings.bookingId, bookingId));
      }
      const updated = await db.select().from(bookings).where(eq(bookings.bookingId, bookingId));
      return updated[0];
    }
  )

  .get("*", ({ set }) => {
    set.status = 404;
    return {
      message: "Not found, from routes.ts",
    };
  })

  .post("/hook", async ({ headers, body, set }) => {
    // read header x-matchi-signature from request
    const signature = headers["x-matchi-signature"] as string;
    logger.info("routes.ts hook hello", { signature });
    if (!signature) {
      set.status = 400;
      return;
    }
    const json = body;
    try {
      await handleWebhook(json as MatchiWebhookJson);
    } catch (e: any) {
      logger.error("Error in routes.ts", { error: e });
    }
    set.status = 200;
  })

  .get("/courts/:court/show-image", async ({ params: { court }, set }) => {
    const id = toCourtId(court);
    return handleShowImage(id, set);
  })

  .get(
    "/matchi-courts/:matchiCourtId/show-image",
    async ({ params: { matchiCourtId }, set }) => {
      if (!isValidMatchiCourtId(matchiCourtId)) {
        set.status = 404;
        return;
      }
      return handleShowImage(matchiCourtId, set);
    }
  )
  .get(
    "/matchi-courts/:matchiCourtId/show-message",
    async ({ params: { matchiCourtId }, query, set }) => {
      if (!isValidMatchiCourtId(matchiCourtId)) {
        set.status = 404;
        return;
      }
      const forceCurrent = isTruthyQueryParam(query?.debug);
      return handleShowMessage(matchiCourtId, set, { forceCurrent });
    }
  )

  .get("/images/start", async ({ set }) => {
    try {
      logger.info("routes.ts get /images/start hello");
      const processedImageBuffer = await getStartImage("Marcus");
      set.headers["Content-Type"] = "image/jpeg";
      return processedImageBuffer;
    } catch (error) {
      logger.error("Error generating image:", { error });
      set.status = 500;
    }
  })

  .get("/images/slut-slut", async ({ set }) => {
    try {
      const processedImageBuffer = await getEndImage("Marcus", false);
      set.headers["Content-Type"] = "image/jpeg";
      return processedImageBuffer;
    } catch (error) {
      logger.error("Error generating image:", { error });
      set.status = 500;
    }
  })

  .get("/images/slut-boka-mer", async ({ set }) => {
    try {
      const processedImageBuffer = await getEndImage("Marcus", true);
      set.headers["Content-Type"] = "image/jpeg";
      return processedImageBuffer;
    } catch (error) {
      logger.error("Error generating image:", { error });
      set.status = 500;
    }
  })

  // Login routes
  .get("/login", ({ set }) => {
    set.headers["Content-Type"] = "text/html";
    const loginPage = readFileSync("./src/pages/login.html", "utf-8");
    return loginPage;
  })

  .post("/login", async ({ body, set }) => {
    const { username, password } = body as {
      username: string;
      password: string;
    };

    if (!(await validateCredentials(username, password))) {
      set.status = 401;
      return { error: "Invalid credentials" };
    }

    try {
      const token = await createSessionToken(username);
      // Set the JWT token in a cookie
      set.headers[
        "Set-Cookie"
      ] = `auth=${token}; Path=/; HttpOnly; SameSite=Strict${secureCookie}`;

      // Get current date for the redirect
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11

      return {
        ok: true,
        redirected: true,
        url: `./booking_summary/${currentYear}/${currentMonth}`,
      };
    } catch (error) {
      set.status = 500;
      return { error: "Authentication failed" };
    }
  })

  .get("/booking_summary/:year/:month", async ({ params, set, headers }) => {
    const authResult = await verifyAuthFromCookie(headers, set);
    if (authResult !== true) {
      // Use relative path
      set.redirect = "../../login";
      set.status = 302;
      return;
    }

    // Continue with existing logic
    try {
      const year = parseInt(params.year, 10);
      const month = parseInt(params.month, 10);
      const summary = await getMonthlyBookingSummary(year, month);
      const html = generateBookingSummaryHTML(summary, year, month);
      set.headers["Content-Type"] = "text/html";
      return html;
    } catch (error) {
      if (error instanceof Error) {
        set.status = 400;
        return { error: error.message };
      }
      set.status = 500;
      return { error: "An unexpected error occurred." };
    }
  })

  .get("/logout", ({ set }) => {
    // Clear the auth cookie
    set.headers[
      "Set-Cookie"
    ] = `auth=; Path=/; HttpOnly; SameSite=Strict${secureCookie}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

    // Use relative path
    set.redirect = "../login";
    set.status = 302;
    return;
  });

function toCourtId(court: string): string {
  return BAY_TO_COURT[court] ?? court;
}

function isValidMatchiCourtId(id: string): boolean {
  return VALID_MATCHI_COURT_IDS.has(id);
}

async function handleShowImage(courtId: string, set: any) {
  try {
    const userMessage = await showUserMessageForCourt(courtId);
    if (userMessage) {
      const { type, firstName: rawFirstName, lastName } = userMessage;
      const firstName = normalizeFirstName(rawFirstName, lastName);
      let imageBuffer;
      if (type === "start") {
        imageBuffer = await getStartImage(firstName);
      } else if (type === "end-free") {
        imageBuffer = await getEndImage(firstName, true);
      } else if (type === "end-occupied") {
        imageBuffer = await getEndImage(firstName, false);
      }
      set.headers["Content-Type"] = "image/jpg";
      return imageBuffer;
    } else {
      set.status = 404;
    }
  } catch (error) {
    logger.error("Error generating image: " + JSON.stringify({ error }));
    set.status = 500;
  }
}

async function handleShowMessage(
  courtId: string,
  set: any,
  options: { forceCurrent?: boolean } = {}
) {
  try {
    const userMessage = await showUserMessageForCourt(courtId, options);
    if (!userMessage) {
      set.status = 404;
      return;
    }

    const { type, firstName: rawFirstName, lastName, booking } = userMessage;
    const customerName = normalizeFirstName(rawFirstName, lastName);
    const skillLevel = await getSkillLevelForCustomer(booking.customerId);
    const courseSuggestion = await getCourseSuggestionForCustomer(
      booking.customerId,
      skillLevel
    );

    return {
      type: mapMessageType(type),
      customerName,
      startTime: formatTimeHHmm(new Date(booking.startTime)),
      endTime: formatTimeHHmm(new Date(booking.endTime)),
      level: skillLevel,
      courseSuggestion,
      bookingUrl: buildBookingUrl(new Date(booking.startTime)),
    };
  } catch (error) {
    logger.error("Error generating message: " + JSON.stringify({ error }));
    set.status = 500;
  }
}

function normalizeFirstName(rawFirstName: string, lastName: string): string {
  if (rawFirstName === "Ambassadör") {
    return "Amb " + lastName.split(" ")[0];
  }
  if (rawFirstName.startsWith("Ambassadör ")) {
    return "Amb " + rawFirstName.slice("Ambassadör ".length);
  }
  return rawFirstName;
}

function isTruthyQueryParam(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function mapMessageType(
  type: "start" | "end-free" | "end-occupied"
): "welcome" | "ending-free" | "ending-booked" {
  if (type === "start") {
    return "welcome";
  }
  if (type === "end-free") {
    return "ending-free";
  }
  return "ending-booked";
}

function formatTimeHHmm(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDateYYYYMMDD(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildBookingUrl(date: Date): string {
  const bookingDate = formatDateYYYYMMDD(date);
  return `https://www.matchi.se/facilities/swedenindoorgolf?date=${bookingDate}&sport=`;
}

async function getStartImage(firstName: string) {
  const boldText = `Hej  ${firstName}, välkommen till Sweden Indoor Golf!`;
  const normalText =
    "Dax för en bra runda :) Kolla in affischen nedan om du har problem!";

  const processedImageBuffer = await addTextToImage(normalText, boldText);
  return processedImageBuffer;
}

async function getEndImage(
  firstName: string,
  nextSlotAvailableForBooking: boolean
) {
  const boldText = `${firstName}, din tid är snart slut!`;
  const normalText = nextSlotAvailableForBooking
    ? "Banan är ledig nästa tid. Boka mer i Matchi?"
    : "Nästa spelare kommer strax. Dags att börja avsluta :)";
  const processedImageBuffer = await addTextToImage(normalText, boldText);
  return processedImageBuffer;
}

async function verifyAuthFromCookie(headers: any, set: any) {
  const cookieHeader = headers.cookie || "";
  const authToken = cookieHeader
    .split(";")
    .find((c: string) => c.trim().startsWith("auth="))
    ?.split("=")[1];

  const isAuthenticated = await verifySessionToken(authToken);
  if (!isAuthenticated) {
    return false;
  }
  return true;
}

export default routes;
