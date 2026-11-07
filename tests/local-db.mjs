import { execFileSync } from "node:child_process";
export function localSql(sql) {
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      ".sites-runtime/local-migrations.json",
      "--persist-to",
      ".wrangler/state",
      "--command",
      sql,
      "--json",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(output)[0].results;
}
export function mailToken(email, purpose) {
  if (
    !/^[a-zA-Z0-9@._+-]+$/.test(email) ||
    !["verify", "reset"].includes(purpose)
  )
    throw new Error("Invalid test mailbox");
  const rows = localSql(
    `SELECT link FROM local_mail WHERE recipient='${email}' AND purpose='${purpose}' ORDER BY created_at DESC LIMIT 1`,
  );
  if (!rows[0]) throw new Error("No local email captured");
  return new URLSearchParams(new URL(rows[0].link).hash.slice(1)).get("token");
}
