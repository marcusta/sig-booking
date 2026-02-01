import { Elysia } from "elysia";
import { readFileSync } from "fs";
import type { MatchiWebhookJson } from "matchi_types";
import { getMonthlyBookingSummary } from "services/booking_analysis";
import { generateBookingSummaryHTML } from "services/html_generator";
import { showUserMessageForCourt } from "user_message";
import { handleWebhook } from "webhook_handlers";
import { BAY_TO_COURT, VALID_MATCHI_COURT_IDS } from "./courts";
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
      const firstName =
        rawFirstName === "Ambassadör"
          ? "Amb " + lastName.split(" ")[0]
          : rawFirstName.startsWith("Ambassadör ")
            ? "Amb " + rawFirstName.slice("Ambassadör ".length)
            : rawFirstName;
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
