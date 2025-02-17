import { Elysia } from "elysia";
import { readFileSync } from "fs";
import type { MatchiWebhookJson } from "matchi_types";
import { getMonthlyBookingSummary } from "services/booking_analysis";
import { generateBookingSummaryHTML } from "services/html_generator";
import { showUserMessageForCourt } from "user_message";
import { handleWebhook } from "webhook_handlers";
import { addTextToImage } from "./image/image-generator";
import logger from "./logger";
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
      message: "Not found, from matchi_routes.ts",
    };
  })

  .post("/hook", ({ headers, body, set }) => {
    // read header x-matchi-signature from request
    const signature = headers["x-matchi-signature"] as string;
    logger.info("matchi_routes.ts hook hello", { signature });
    if (!signature) {
      set.status = 400;
      return;
    }
    const json = body;
    try {
      handleWebhook(json as MatchiWebhookJson);
      set.status = 200;
    } catch (e: any) {
      if (e.status) {
        set.status = e.status;
      } else {
        logger.error("Error in matchi_routes.ts", { error: e });
        set.status = 200;
      }
    }
  })

  .get("/courts/:court/show-image", async ({ params: { court }, set }) => {
    const id = toCourtId(court);
    try {
      const userMessage = await showUserMessageForCourt(id);
      if (userMessage) {
        const { type, firstName } = userMessage;
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
  })

  .get("/images/start", async ({ set }) => {
    try {
      logger.info("matchi_routes.ts get /images/start hello");
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
      console.log("token created");
      // Set the JWT token in a cookie
      set.headers[
        "Set-Cookie"
      ] = `auth=${token}; Path=/; HttpOnly; SameSite=Strict`;

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

  .get(
    "/booking_summary/:year/:month",
    async ({ params, set, headers, request }) => {
      const authResult = await verifyAuthFromCookie(headers, set);
      if (authResult !== true) {
        // Get base path from the referer URL
        const referer = headers.referer || headers.referrer;
        console.log("referer", referer);
        const basePath = referer
          ? new URL(referer).pathname.split("/booking_summary")[0]
          : "";
        const redirectUrl = `${basePath}/login`;
        console.log("redirectUrl", redirectUrl);
        set.redirect = redirectUrl;
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
    }
  )

  .get("/logout", ({ set, headers }) => {
    // Clear the auth cookie
    set.headers[
      "Set-Cookie"
    ] = `auth=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

    const referer = headers.referer || headers.referrer;
    const basePath = referer
      ? new URL(referer).pathname.split("/logout")[0]
      : "";
    set.redirect = `${basePath}/login`;
    set.status = 302;
    return;
  });

function toCourtId(court: string): string {
  const courts: { [key: string]: string } = {
    "1": "2068",
    "2": "2069",
    "3": "2074",
    "4": "2071",
    "5": "2072",
    "6": "2070",
    "7": "2076",
    "8": "2077",
  };
  if (courts[court]) {
    return courts[court];
  }
  return court;
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
