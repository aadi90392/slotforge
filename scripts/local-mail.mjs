// Local developer mailbox only. Never connects to a remote database.
import { localSql } from "../tests/local-db.mjs";
const email = process.argv[2];
if (!email || !/^[a-zA-Z0-9@._+-]+$/.test(email))
  throw new Error("Usage: npm run mail:local -- your-test-email");
const rows = localSql(
  `SELECT purpose,link,created_at FROM local_mail WHERE recipient='${email}' ORDER BY created_at DESC LIMIT 5`,
);
for (const row of rows) console.log(`${row.purpose}: ${row.link}`);
