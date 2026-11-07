import {
  assert,
  body,
  cookie,
  db,
  digest,
  json,
  passwordHash,
  rateLimit,
  requireUser,
  verifyPassword,
} from "./server";
import { requireMail, sendAccountLink } from "./mail";

export async function accountRoute(
  req: Request,
  path: string,
): Promise<Response | null> {
  if (req.method !== "POST") return null;
  if (path === "auth/forgot" || path === "auth/resend") {
    requireMail(req);
    await rateLimit(req, "account-email", 5);
    const b = await body(req),
      email = String(b.email || "")
        .trim()
        .toLowerCase();
    assert(email.length <= 180, "Invalid email");
    await rateLimit(req, "account-email-recipient", 3, email);
    const user = await db()
      .prepare(
        "SELECT id,email,email_verified FROM users WHERE email=? AND deleted_at IS NULL",
      )
      .bind(email)
      .first<{ id: string; email: string; email_verified: number }>();
    if (user && (path === "auth/forgot" || !user.email_verified)) {
      // An email failure must not disclose whether this account exists.
      try {
        await sendAccountLink(
          req,
          user,
          path === "auth/forgot" ? "reset" : "verify",
        );
      } catch {
        console.error("account_email_delivery_failed");
      }
    }
    return json({
      message:
        "If this account is eligible, an email has been sent. Check your inbox and spam folder.",
    });
  }
  if (path === "auth/verify" || path === "auth/reset") {
    await rateLimit(req, "account-token", 20);
    const b = await body(req),
      raw = String(b.token || "");
    assert(/^[a-f0-9]{64}$/.test(raw), "Invalid or expired link");
    const token = await digest(raw),
      purpose = path === "auth/reset" ? "reset" : "verify",
      now = Date.now();
    const match = await db()
      .prepare(
        "SELECT t.user_id FROM auth_tokens t JOIN users u ON u.id=t.user_id WHERE t.token=? AND t.purpose=? AND t.expires>? AND u.deleted_at IS NULL",
      )
      .bind(token, purpose, now)
      .first<{ user_id: string }>();
    assert(match, "Invalid or expired link", 400);
    const condition =
      "EXISTS(SELECT 1 FROM auth_tokens WHERE token=? AND purpose=? AND expires>?)";
    if (purpose === "verify") {
      const results = await db().batch([
        db()
          .prepare(
            `UPDATE users SET email_verified=1 WHERE id=? AND ${condition}`,
          )
          .bind(match.user_id, token, purpose, now),
        db().prepare("DELETE FROM auth_tokens WHERE token=?").bind(token),
      ]);
      assert(results[0].meta.changes === 1, "Link already used", 400);
    } else {
      const password = String(b.password || "");
      assert(
        password.length >= 12 && password.length <= 128,
        "Use a password with 12-128 characters",
      );
      const hash = await passwordHash(password);
      const results = await db().batch([
        db()
          .prepare(
            `UPDATE users SET password=?,email_verified=1 WHERE id=? AND ${condition}`,
          )
          .bind(hash, match.user_id, token, purpose, Date.now()),
        db()
          .prepare(`DELETE FROM sessions WHERE user_id=? AND ${condition}`)
          .bind(match.user_id, token, purpose, Date.now()),
        db()
          .prepare("DELETE FROM auth_tokens WHERE user_id=?")
          .bind(match.user_id),
      ]);
      assert(results[0].meta.changes === 1, "Invalid or expired link", 400);
    }
    return json({ ok: true });
  }
  if (path === "auth/delete") {
    const user = await requireUser(req),
      b = await body(req);
    await rateLimit(req, "delete-account", 5);
    assert(b.confirmation === "DELETE", "Type DELETE to confirm");
    const stored = await db()
      .prepare("SELECT password FROM users WHERE id=?")
      .bind(user.id)
      .first<{ password: string }>();
    assert(
      String(b.password || "").length <= 128 &&
        stored &&
        (await verifyPassword(String(b.password || ""), stored.password)),
      "Password is incorrect",
      403,
    );
    const shared = await db()
      .prepare(
        "SELECT w.id FROM workspaces w JOIN members m ON m.workspace_id=w.id WHERE w.owner_id=? AND m.user_id<>? LIMIT 1",
      )
      .bind(user.id, user.id)
      .first();
    assert(
      !shared,
      "Remove other members from your owned workspaces before deleting your account.",
      409,
    );
    const now = Date.now();
    await db().batch([
      db()
        .prepare(
          "UPDATE bookings SET status='cancelled',updated_at=?,updated_by=? WHERE user_id=? AND status IN ('held','confirmed') AND (day>? OR (day=? AND hour>?))",
        )
        .bind(
          now,
          user.id,
          user.id,
          new Date(now + 19800000).toISOString().slice(0, 10),
          new Date(now + 19800000).toISOString().slice(0, 10),
          new Date(now + 19800000).getUTCHours(),
        ),
      db()
        .prepare(
          "UPDATE resources SET active=0 WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id=?)",
        )
        .bind(user.id),
      db().prepare("DELETE FROM members WHERE user_id=?").bind(user.id),
      db().prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id),
      db().prepare("DELETE FROM auth_tokens WHERE user_id=?").bind(user.id),
      db()
        .prepare(
          "UPDATE users SET name='Deleted member',email=?,password='',email_verified=0,deleted_at=? WHERE id=?",
        )
        .bind(`deleted-${user.id}@invalid.local`, now, user.id),
    ]);
    return json({ ok: true }, 200, { "Set-Cookie": cookie(req, "", 0) });
  }
  return null;
}
