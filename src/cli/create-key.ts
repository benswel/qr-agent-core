import { runMigrations } from "../db/migrate.js";
import { generateApiKey } from "../modules/auth/auth.service.js";

const label = process.argv[2] || "default";

runMigrations();

const result = generateApiKey(label);

console.log(`
╔══════════════════════════════════════════════════╗
║           API Key Created                        ║
╠══════════════════════════════════════════════════╣
║  Label:  ${result.label.padEnd(39)}║
║  Key:    ${result.key.padEnd(39)}║
╚══════════════════════════════════════════════════╝

Save this key — it cannot be retrieved later.
Use it in requests: curl -H "X-API-Key: ${result.key}" ...
`);
