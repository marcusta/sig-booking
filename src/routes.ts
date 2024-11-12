import { Elysia } from "elysia";
import type { MatchiWebhookJson } from "matchi_types";
import { showUserMessageForCourt } from "user_message";
import { handleWebhook } from "webhook_handlers";
import { addTextToImage } from "./image/image-generator";
import logger from "./logger";

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

export default routes;
