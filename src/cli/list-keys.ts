import { runMigrations } from "../db/migrate.js";
import { listApiKeys } from "../modules/auth/auth.service.js";

runMigrations();

const keys = listApiKeys();

if (keys.length === 0) {
  console.log("No API keys found. Create one with: npm run key:create");
  process.exit(0);
}

console.log("\nAPI Keys:\n");
console.log("ID  | Label            | Preview       | Last Used            | Expires");
console.log("----|------------------|---------------|----------------------|--------");

for (const key of keys) {
  console.log(
    `${String(key.id).padEnd(4)}| ${(key.label || "").padEnd(17)}| ${key.keyPreview.padEnd(14)}| ${(key.lastUsedAt || "never").padEnd(21)}| ${key.expiresAt || "never"}`
  );
}

console.log();
