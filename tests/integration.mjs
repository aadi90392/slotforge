import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
assert(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Integration tests create sample accounts: run only on localhost.",
);
const stamp = randomUUID().slice(0, 8),
  password = randomUUID() + "Aa!";
function client() {
  let cookie = "";
  return async (path, data, origin = base) => {
    const res = await fetch(base + "/api/" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        ...(data === undefined
          ? {}
          : { "Content-Type": "application/json", Origin: origin }),
        Cookie: cookie,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
    return { status: res.status, body, cookie: set };
  };
}
const owner = client(),
  other = client(),
  member = client(),
  anonymous = client();
let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log("PASS " + name);
}
let r = await owner("auth/register", {
  name: "Test Owner",
  email: `owner-${stamp}@example.test`,
  password,
});
check("register with secure session attributes", () => {
  assert.equal(r.status, 200);
  assert.match(r.cookie, /HttpOnly/);
  assert.match(r.cookie, /SameSite=Lax/);
});
const ownerId = r.body.user.id;
r = await owner("workspaces");
const ws = r.body.workspaces[0].id;
let dash = (await owner("dashboard?workspace=" + ws)).body;
check("new workspace starts empty", () => assert.equal(dash.rooms.length, 0));
for (let i = 0; i < 4; i++) {
  const created = await owner("resources?workspace=" + ws, {name: `Room ${i + 1}`, kind:"Meeting room", capacity:6, location:"First floor", amenities:"Whiteboard"});
  assert.equal(created.status, 200);
}
dash = (await owner("dashboard?workspace=" + ws)).body;
check("owner adds actual room inventory", () => assert.equal(dash.rooms.length, 4));
const resource = dash.rooms[0].id;
const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const payload = {
  resourceId: resource,
  day: tomorrow,
  hour: 10,
  title: "Concurrency verification",
  key: randomUUID(),
};
r = await anonymous("dashboard?workspace=" + ws);
check("anonymous protected API rejected", () => assert.equal(r.status, 401));
r = await owner(
  "bookings?workspace=" + ws,
  payload,
  "https://untrusted.example",
);
check("cross-origin mutation rejected", () => assert.equal(r.status, 403));
await other("auth/register", {
  name: "Other Owner",
  email: `other-${stamp}@example.test`,
  password,
});
r = await other("dashboard?workspace=" + ws);
check("cross-workspace data access rejected", () =>
  assert.equal(r.status, 404),
);
const contenders = await Promise.all(
  Array.from({ length: 50 }, () =>
    owner("bookings?workspace=" + ws, { ...payload, key: randomUUID() }),
  ),
);
const winners = contenders.filter((r) => r.status === 201);
check("50 concurrent requests yield one held booking", () => {
  assert.equal(winners.length, 1);
  assert.equal(contenders.filter((r) => r.status === 409).length, 49);
});
const booking = winners[0].body.booking;
r = await owner(`bookings/${booking.id}?workspace=${ws}`, {
  action: "confirm",
});
check("hold confirms successfully", () => assert.equal(r.status, 200));
r = await owner(`bookings/${booking.id}?workspace=${ws}`, {
  action: "confirm",
});
check("confirmation is idempotent", () => assert.equal(r.status, 200));
const p2 = { ...payload, hour: 11, key: randomUUID() };
const first = await owner("bookings?workspace=" + ws, p2),
  retry = await owner("bookings?workspace=" + ws, p2);
check("repeated event key returns same booking", () => {
  assert.equal(first.status, 201);
  assert.equal(retry.body.booking.id, first.body.booking.id);
});
r = await owner("bookings?workspace=" + ws, { ...p2, hour: 12 });
check("idempotency key cannot change payload", () =>
  assert.equal(r.status, 409),
);
r = await owner(`bookings/${booking.id}?workspace=${ws}`, {
  action: "reschedule",
  day: tomorrow,
  hour: 11,
});
check("rescheduling into occupied slot fails", () =>
  assert.equal(r.status, 409),
);
dash = (await owner("dashboard?workspace=" + ws)).body;
check("failed reschedule preserves original slot", () =>
  assert.equal(dash.bookings.find((b) => b.id === booking.id).hour, 10),
);
r = await owner(`bookings/${booking.id}?workspace=${ws}`, {
  action: "reschedule",
  day: tomorrow,
  hour: 12,
});
check("reschedule to free slot works", () => assert.equal(r.status, 200));
await member("auth/register", {
  name: "Team Member",
  email: `member-${stamp}@example.test`,
  password,
});
const invite = (await owner("settings?workspace=" + ws)).body.invite_code;
r = await member("workspaces", { invite });
check("invitation grants membership", () => assert.equal(r.status, 200));
r = await member("dashboard?workspace=" + ws);
check("joined member reads workspace", () => assert.equal(r.status, 200));
r = await member("settings?workspace=" + ws);
check("member cannot read private invite settings", () =>
  assert.equal(r.status, 403),
);
r = await member(`bookings/${booking.id}?workspace=${ws}`, {
  action: "cancel",
});
check("member cannot cancel another user booking", () =>
  assert.equal(r.status, 403),
);
r = await owner("bookings?workspace=" + ws, {
  ...payload,
  day: "2020-01-01",
  key: randomUUID(),
});
check("past booking rejected", () => assert.equal(r.status, 400));
r = await owner(`bookings/${booking.id}?workspace=${ws}`, { action: "cancel" });
check("booking cancellation works", () => assert.equal(r.status, 200));
dash = (await owner("dashboard?workspace=" + ws)).body;
check("audit trail contains reschedule and cancel", () => {
  assert(dash.activity.some((a) => a.action === "rescheduled"));
  assert(dash.activity.some((a) => a.action === "cancelled"));
});
const simultaneousPayload = { ...payload, hour: 14, key: randomUUID() };
const retries = await Promise.all(
  Array.from({ length: 10 }, () =>
    owner("bookings?workspace=" + ws, simultaneousPayload),
  ),
);
check("simultaneous identical retries return the same booking", () => {
  assert(retries.every((r) => r.status === 200 || r.status === 201));
  assert.equal(new Set(retries.map((r) => r.body.booking.id)).size, 1);
});
const expiryPayload = { ...payload, hour: 15, key: randomUUID() };
const expiring = (await owner("bookings?workspace=" + ws, expiryPayload)).body
  .booking;
assert.match(expiring.id, /^[0-9a-f-]{36}$/);
execFileSync(
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
    "dist/server/wrangler.json",
    "--persist-to",
    ".wrangler/state",
    "--command",
    `UPDATE bookings SET hold_until=0 WHERE id='${expiring.id}'`,
  ],
  { stdio: "pipe" },
);
r = await owner(`bookings/${expiring.id}?workspace=${ws}`, {
  action: "confirm",
});
check("expired reservation cannot be confirmed", () =>
  assert.equal(r.status, 409),
);
r = await owner("bookings?workspace=" + ws, {
  ...expiryPayload,
  key: randomUUID(),
});
check("expired hold releases the unique slot", () =>
  assert.equal(r.status, 201),
);
r = await owner("bookings?workspace=" + ws, null);
check("non-object JSON rejected", () => assert.equal(r.status, 400));
r = await owner("auth/logout", {});
assert.equal(r.status, 200);
r = await owner("auth/me");
check("logout revokes session", () => assert.equal(r.body.user, null));
r = await owner("auth/login", {
  email: `owner-${stamp}@example.test`,
  password,
});
check("existing account signs back in", () => assert.equal(r.status, 200));
r = await anonymous("auth/login", {
  email: `owner-${stamp}@example.test`,
  password: "not-the-right-password",
});
check("wrong password rejected", () => assert.equal(r.status, 401));
const secondSession = client();
await secondSession("auth/login",{email:`owner-${stamp}@example.test`,password});
r = await owner("auth/password",{currentPassword:"wrong",newPassword:password+"new"});
check("password change requires current password",()=>assert.equal(r.status,403));
r = await owner("auth/password",{currentPassword:password,newPassword:password+"new"});
check("password change succeeds",()=>assert.equal(r.status,200));
r = await secondSession("auth/me");
check("password change revokes other sessions",()=>assert.equal(r.body.user,null));
r = await secondSession("auth/login",{email:`owner-${stamp}@example.test`,password});
check("old password no longer works",()=>assert.equal(r.status,401));
r = await secondSession("auth/login",{email:`owner-${stamp}@example.test`,password:password+"new"});
check("new password signs in",()=>assert.equal(r.status,200));
r = await owner("resources?workspace="+ws,{id:resource,name:"Renamed room",kind:"Meeting room",capacity:8,location:"West wing",amenities:"Screen"});
check("owner edits room",()=>assert.equal(r.status,200));
r = await member("resources?workspace="+ws,{id:resource,name:"Unauthorized",kind:"Meeting room",capacity:8,location:"West wing"});
check("member cannot edit room",()=>assert.equal(r.status,403));
r = await other("resources?workspace="+ws,{id:resource,name:"Unauthorized",kind:"Meeting room",capacity:8,location:"West wing"});
check("other workspace cannot edit room",()=>assert.equal(r.status,404));
console.log(
  `\n${checks} integration checks passed. Local test accounts: ${stamp}.`,
);
