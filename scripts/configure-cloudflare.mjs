import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const [databaseId, workerName = "slotforge"] = process.argv.slice(2);
if (
  !databaseId ||
  !/^[0-9a-f-]{36}$/i.test(databaseId) ||
  !/^[a-z][a-z0-9-]{1,45}$/.test(workerName)
) {
  console.error(
    "Usage: node scripts/configure-cloudflare.mjs <D1-database-UUID> [worker-name]",
  );
  process.exit(1);
}
const file = resolve("dist/server/wrangler.json");
const config = JSON.parse(await readFile(file, "utf8"));
config.name = workerName;
delete config.topLevelName;
config.d1_databases = [
  {
    binding: "DB",
    database_name: "slotforge-db",
    database_id: databaseId,
    migrations_dir: resolve("drizzle"),
  },
];
config.workers_dev = true;
await writeFile(file, JSON.stringify(config, null, 2) + "\n");
console.log(
  "Standalone Cloudflare config prepared. No account changes or deployment performed.",
);
