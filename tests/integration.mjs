import { localSql, mailToken } from "./local-db.mjs";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
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
  const testIp =
    "fd00:" +
    randomUUID().replaceAll("-", "").match(/.{4}/g).slice(0, 7).join(":");
  return async (path, data, origin = base) => {
    const res = await fetch(base + "/api/" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        ...(data === undefined
          ? {}
          : { "Content-Type": "application/json", Origin: origin }),
        Cookie: cookie,
        "CF-Connecting-IP": testIp,
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
async function registerVerified(call, fields) {
  const registered = await call("auth/register", fields);
  assert.equal(registered.status, 200, JSON.stringify(registered.body));
  assert.equal(registered.body.verificationRequired, true);
  const unverified = await call("auth/login", {
    email: fields.email,
    password: fields.password,
  });
  check("unverified email cannot sign in", () =>
    assert.equal(unverified.status, 403),
  );
  const token = mailToken(fields.email, "verify");
  const verified = await call("auth/verify", { token });
  check("verification link accepted", () => assert.equal(verified.status, 200));
  const reused = await call("auth/verify", { token });
  check("verification link is single use", () =>
    assert.equal(reused.status, 400),
  );
  return call("auth/login", { email: fields.email, password: fields.password });
}
let r = await registerVerified(owner, {
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
  const created = await owner("resources?workspace=" + ws, {
    name: `Room ${i + 1}`,
    kind: "Meeting room",
    capacity: 6,
    location: "First floor",
    amenities: "Whiteboard",
  });
  assert.equal(created.status, 200);
}
dash = (await owner("dashboard?workspace=" + ws)).body;
check("owner adds actual room inventory", () =>
  assert.equal(dash.rooms.length, 4),
);
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
await registerVerified(other, {
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
await registerVerified(member, {
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
    ".sites-runtime/local-migrations.json",
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
await secondSession("auth/login", {
  email: `owner-${stamp}@example.test`,
  password,
});
r = await owner("auth/password", {
  currentPassword: "wrong",
  newPassword: password + "new",
});
check("password change requires current password", () =>
  assert.equal(r.status, 403),
);
r = await owner("auth/password", {
  currentPassword: password,
  newPassword: password + "new",
});
check("password change succeeds", () => assert.equal(r.status, 200));
r = await secondSession("auth/me");
check("password change revokes other sessions", () =>
  assert.equal(r.body.user, null),
);
r = await secondSession("auth/login", {
  email: `owner-${stamp}@example.test`,
  password,
});
check("old password no longer works", () => assert.equal(r.status, 401));
r = await secondSession("auth/login", {
  email: `owner-${stamp}@example.test`,
  password: password + "new",
});
check("new password signs in", () => assert.equal(r.status, 200));
r = await owner("resources?workspace=" + ws, {
  id: resource,
  name: "Renamed room",
  kind: "Meeting room",
  capacity: 8,
  location: "West wing",
  amenities: "Screen",
});
check("owner edits room", () => assert.equal(r.status, 200));
r = await member("resources?workspace=" + ws, {
  id: resource,
  name: "Unauthorized",
  kind: "Meeting room",
  capacity: 8,
  location: "West wing",
});
check("member cannot edit room", () => assert.equal(r.status, 403));
r = await other("resources?workspace=" + ws, {
  id: resource,
  name: "Unauthorized",
  kind: "Meeting room",
  capacity: 8,
  location: "West wing",
});
check("other workspace cannot edit room", () => assert.equal(r.status, 404));

r = await anonymous("auth/forgot", { email: `owner-${stamp}@example.test` });
check("password recovery gives generic response", () =>
  assert.equal(r.status, 200),
);
const resetToken = mailToken(`owner-${stamp}@example.test`, "reset");
r = await anonymous("auth/reset", {
  token: resetToken,
  password: password + "reset",
});
check("reset token changes password", () => assert.equal(r.status, 200));
r = await owner("auth/me");
check("password reset invalidates sessions", () =>
  assert.equal(r.body.user, null),
);
r = await anonymous("auth/reset", {
  token: resetToken,
  password: password + "reused",
});
check("reset token cannot be replayed", () => assert.equal(r.status, 400));
await owner("auth/login", {
  email: `owner-${stamp}@example.test`,
  password: password + "reset",
});
r = await owner("booking-history?workspace=" + ws + "&page=1&filter=All");
check("history includes cancelled bookings", () =>
  assert(r.body.bookings.some((b) => b.status === "cancelled")),
);
r = await owner("booking-history?workspace=" + ws + "&page=1.5");
check("fractional page rejected", () => assert.equal(r.status, 400));
r = await member("resources/archive?workspace=" + ws, { id: resource });
check("member cannot archive room", () => assert.equal(r.status, 403));
const historyRoom = (await owner("dashboard?workspace=" + ws)).body.rooms.find(
  (r) => r.id !== resource,
).id;
localSql(
  `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1001) INSERT INTO bookings(id,workspace_id,resource_id,user_id,title,day,hour,status,idempotency_key,created_at,updated_at,updated_by) SELECT '${stamp}-history-'||n,'${ws}','${historyRoom}','${ownerId}','Historical booking '||n,'2024-01-01',8,'cancelled','${stamp}-key-'||n,1,1,'${ownerId}' FROM seq`,
);
const firstPage = (
  await owner("booking-history?workspace=" + ws + "&page=1&filter=All")
).body;
const nextPage = (
  await owner("booking-history?workspace=" + ws + "&page=2&filter=All")
).body;
check("history beyond 1000 records is paginated without overlap", () => {
  assert(firstPage.total > 1000);
  assert.equal(firstPage.bookings.length, 25);
  assert.equal(nextPage.bookings.length, 25);
  assert(
    !nextPage.bookings.some((b) =>
      firstPage.bookings.some((a) => a.id === b.id),
    ),
  );
});
r = await owner("dashboard?workspace=" + ws);
check("old history cannot displace upcoming availability", () =>
  assert(r.body.bookings.some((b) => b.day === tomorrow)),
);
r = await owner("resources/archive?workspace=" + ws, { id: resource });
check("owner archives room", () => assert.equal(r.status, 200));
r = await owner("bookings?workspace=" + ws, {
  ...payload,
  hour: 16,
  key: randomUUID(),
});
check("archived room rejects reservations", () => assert.equal(r.status, 404));
dash = (await owner("dashboard?workspace=" + ws)).body;
check("archived room hidden and future bookings cancelled", () => {
  assert(!dash.rooms.some((r) => r.id === resource));
  assert(
    !dash.bookings.some(
      (b) =>
        b.resource_id === resource && ["held", "confirmed"].includes(b.status),
    ),
  );
});
r = await owner("auth/delete", {
  password: password + "reset",
  confirmation: "DELETE",
});
check("owner cannot abandon shared workspace", () =>
  assert.equal(r.status, 409),
);
const memberId = (await member("auth/me")).body.user.id;
r = await member("members/remove?workspace=" + ws, { userId: ownerId });
check("member cannot remove owner", () => assert.equal(r.status, 403));
const oldInvite = (await owner("settings?workspace=" + ws)).body.invite_code;
r = await owner("members/remove?workspace=" + ws, { userId: memberId });
check("owner removes teammate", () => assert.equal(r.status, 200));
r = await member("dashboard?workspace=" + ws);
check("removed teammate loses access", () => assert.equal(r.status, 404));
r = await member("workspaces", { invite: oldInvite });
check("removed member cannot reuse old invite", () =>
  assert.equal(r.status, 404),
);
await anonymous("auth/forgot", { email: `owner-${stamp}@example.test` });
const expiredToken = mailToken(`owner-${stamp}@example.test`, "reset");
localSql(
  `UPDATE auth_tokens SET expires=0 WHERE token='${createHash("sha256").update(expiredToken).digest("hex")}'`,
);
r = await anonymous("auth/reset", {
  token: expiredToken,
  password: password + "expired",
});
check("expired reset link rejected", () => assert.equal(r.status, 400));
await anonymous("auth/forgot", { email: `owner-${stamp}@example.test` });
const raceToken = mailToken(`owner-${stamp}@example.test`, "reset");
const resets = await Promise.all([
  anonymous("auth/reset", { token: raceToken, password: password + "reset" }),
  anonymous("auth/reset", { token: raceToken, password: password + "reset" }),
]);
check("simultaneous reset requests consume token once", () =>
  assert.equal(resets.filter((r) => r.status === 200).length, 1),
);
await owner("auth/login", {
  email: `owner-${stamp}@example.test`,
  password: password + "reset",
});
r = await owner("auth/delete", {
  password: password + "reset",
  confirmation: "DELETE",
});
check("account deletion succeeds after team removal", () =>
  assert.equal(r.status, 200),
);
r = await owner("auth/login", {
  email: `owner-${stamp}@example.test`,
  password: password + "reset",
});
check("deleted account cannot sign in", () => assert.equal(r.status, 401));
console.log(
  `\n${checks} integration checks passed. Local test accounts: ${stamp}.`,
);
