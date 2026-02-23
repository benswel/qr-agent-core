import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config/index.js";
import * as schema from "./schema.js";

// Ensure the data directory exists
mkdirSync(dirname(config.db.url), { recursive: true });

const sqlite = new Database(config.db.url);

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
export { schema };
