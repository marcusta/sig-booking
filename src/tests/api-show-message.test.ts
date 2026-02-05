import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getExactHourFromNow } from "../date";

const cwd = process.cwd();

function runScript(command: string[], env: Record<string, string>) {
  const result = Bun.spawnSync(command, {
    cwd,
    env: { ...process.env, ...env },
  });

  if (result.exitCode !== 0) {
    const stderr = new TextDecoder().decode(result.stderr);
    throw new Error(
      `Command failed: ${command.join(" ")}\n${stderr || "no stderr"}`
    );
  }
}

describe("show-message API", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "sig-booking-"));
  const dbPath = join(tempDir, "test.db");
  let app: any;

  beforeAll(async () => {
    process.env.DB_PATH = dbPath;
    runScript(["bun", "./scripts/migrate.ts"], { DB_PATH: dbPath });
    runScript(["bun", "./scripts/seed.ts"], {
      DB_PATH: dbPath,
      SEED_SCENARIO: "show-message",
    });

    const [{ Elysia }, { default: routes }] = await Promise.all([
      import("elysia"),
      import("../routes"),
    ]);
    app = new Elysia().use(routes);
  }, 30000);

  test("returns a welcome message payload", async () => {
    const response = await app.handle(
      new Request("http://localhost/matchi-courts/2068/show-message")
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.type).toBe("welcome");
    expect(data.customerName).toBe("Marcus");
    expect(data.level).toBe("beginner");
    expect(data.courseSuggestion).toBe("Paynes Vallye");

    const expectedDate = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Stockholm",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(getExactHourFromNow(0));

    expect(data.bookingUrl).toBe(
      `https://www.matchi.se/facilities/swedenindoorgolf?date=${expectedDate}&sport=`
    );
  }, 15000);

  test("returns 404 for invalid court id", async () => {
    const response = await app.handle(
      new Request("http://localhost/matchi-courts/9999/show-message")
    );
    expect(response.status).toBe(404);
  }, 15000);
});
