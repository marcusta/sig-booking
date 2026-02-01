import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const dbPath = process.env.DB_PATH || "./data/matchi.db";
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
