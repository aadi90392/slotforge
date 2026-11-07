import { env } from "cloudflare:workers";
import { ApiError, assert, db, digest, randomToken, uid } from "./server";

export function localDelivery(req: Request) {
  return (
    import.meta.env.DEV &&
    ["127.0.0.1", "localhost"].includes(new URL(req.url).hostname)
  );
}
export function requireMail(req: Request) {
  assert(
    localDelivery(req) ||
      (env.BREVO_API_KEY &&
        env.EMAIL_FROM &&
        env.APP_ORIGIN?.startsWith("https://")),
    "Email delivery is not configured. Contact the workspace administrator.",
    503,
  );
}
export async function sendAccountLink(
  req: Request,
  user: { id: string; email: string },
  purpose: "verify" | "reset",
) {
  requireMail(req);
  const token = randomToken(),
    hashed = await digest(token),
    now = Date.now();
  const origin = localDelivery(req)
    ? new URL(req.url).origin
    : new URL(env.APP_ORIGIN!).origin;
  const link = `${origin}/account#${new URLSearchParams({ purpose, token })}`;
  await db().batch([
    db()
      .prepare(
        "DELETE FROM auth_tokens WHERE expires<? OR (user_id=? AND purpose=?)",
      )
      .bind(now, user.id, purpose),
    db()
      .prepare(
        "INSERT INTO auth_tokens(token,user_id,purpose,expires) VALUES(?,?,?,?)",
      )
      .bind(
        hashed,
        user.id,
        purpose,
        now + (purpose === "reset" ? 30 * 60000 : 24 * 3600000),
      ),
  ]);
  if (localDelivery(req)) {
    await db().batch([
      db()
        .prepare("DELETE FROM local_mail WHERE created_at<?")
        .bind(now - 86400000),
      db()
        .prepare(
          "INSERT INTO local_mail(id,recipient,purpose,link,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(uid(), user.email, purpose, link, now),
    ]);
    return;
  }
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY!.trim(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "SlotForge", email: env.EMAIL_FROM?.trim() },
        to: [{ email: user.email }],
        subject:
          purpose === "verify"
            ? "Verify your SlotForge email"
            : "Reset your SlotForge password",
        textContent: `${purpose === "verify" ? "Verify your email" : "Reset your password"}:\n${link}\n\nThis link expires in ${purpose === "reset" ? "30 minutes" : "24 hours"} and works once. If you did not request this, ignore this email.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({})) as {code?: unknown};
      const code = typeof failure.code === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(failure.code) ? failure.code : "unknown";
      console.error("email_provider_rejected", {status: response.status, code});
      throw new ApiError(503, "Verification email could not be sent. Your account is saved; please use Resend verification after email delivery is restored.");
    }
  } catch (error) {
    await db()
      .prepare("DELETE FROM auth_tokens WHERE token=?")
      .bind(hashed)
      .run();
    if(error instanceof ApiError) throw error;
    console.error("email_provider_connection_failed");
    throw new ApiError(503,"Email service is temporarily unavailable. Please try again later.");
  }
}
