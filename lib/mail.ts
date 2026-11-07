import { env } from "cloudflare:workers";
import { ApiError, assert, db, digest, randomToken, uid } from "./server";

export function accountEmail(purpose: "verify" | "reset", link: string) {
  const verify = purpose === "verify";
  const action = verify ? "Verify email address" : "Reset password";
  const title = verify ? "Your next great idea<br>starts here." : "A fresh start.<br>A secure account.";
  const expiry = verify ? "24 hours" : "30 minutes";
  const intro = verify
    ? "Welcome to SlotForge. Verify your email to sign in, join your team and make room for what comes next."
    : "We received a request to reset your SlotForge password. Choose a new password using the secure link below.";
  const safety = verify
    ? "Didn't create a SlotForge account? You can safely ignore this email."
    : "Didn't request this? You can ignore this email. Your password will stay the same unless you complete the reset.";
  const safeLink = link.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
  return {
    subject: verify ? "Verify your SlotForge email" : "Reset your SlotForge password",
    textContent: `SlotForge\n\n${intro}\n\n${action}:\n${link}\n\nThis link expires in ${expiry} and can be used once. Never share this link.\n\n${safety}\n\nSlotForge | A little room. A big possibility.`,
    htmlContent: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${action} | SlotForge</title></head>
<body style="margin:0;padding:0;background-color:#f2f4ee;color:#222922;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${action} — your secure link is valid for ${expiry}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f4ee;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
<tr><td style="padding:0 8px 24px;font-size:27px;font-weight:700;letter-spacing:-1px;color:#222922;">slotforge<span style="color:#6d825e;">.</span></td></tr>
<tr><td style="background-color:#ffffff;border:1px solid #dfe5d8;border-radius:20px;overflow:hidden;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:32px 28px;background-color:#e8eedf;border-radius:20px 20px 0 0;">
<p style="margin:0 0 18px;font-size:11px;font-weight:700;letter-spacing:2px;color:#536446;">${verify ? "WELCOME TO YOUR WORKSPACE" : "ACCOUNT SECURITY"}</p>
<h1 style="margin:0;font-size:32px;line-height:1.2;font-weight:600;letter-spacing:-1px;color:#222922;">${title}</h1>
</td></tr>
<tr><td style="padding:28px;">
<p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#50594e;">${intro}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#222922" style="border-radius:9px;mso-padding-alt:16px 24px;">
<a href="${safeLink}" style="display:inline-block;padding:16px 24px;border:1px solid #222922;border-radius:9px;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;color:#ffffff;">${action} &rarr;</a>
</td></tr></table>
<p style="margin:18px 0 28px;font-size:13px;line-height:1.6;color:#66735e;">Valid for <strong>${expiry}</strong> &middot; One-time use<br>For your security, don't share this link.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:16px;background-color:#f5f7f1;border-radius:10px;font-size:13px;line-height:1.7;color:#56614f;">${safety}</td></tr></table>
<p style="margin:24px 0 8px;font-size:12px;line-height:1.6;color:#66735e;">Button not working? Copy and paste this full link into your browser:</p>
<p style="margin:0;font-size:12px;line-height:1.7;word-break:break-all;overflow-wrap:anywhere;"><a href="${safeLink}" style="color:#536446;text-decoration:underline;word-break:break-all;">${safeLink}</a></p>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:24px 12px;font-size:12px;line-height:1.8;color:#65715d;">A little room. A big possibility.<br><span style="font-size:11px;">SlotForge &middot; Workspace booking, thoughtfully organized.</span></td></tr>
</table></td></tr></table></body></html>`,
  };
}

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
        ...accountEmail(purpose, link),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const raw = await response.text();
      let failure: {code?: unknown; message?: unknown} = {};
      try { failure = JSON.parse(raw); } catch {}
      const code = typeof failure.code === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(failure.code) ? failure.code : "unknown";
      let reason = String(failure.message || raw.replace(/<[^>]*>/g," "));
      for (const secret of [env.BREVO_API_KEY?.trim(), user.email, token, hashed]) if(secret) reason=reason.split(secret).join("[redacted]");
      reason=reason.replace(/[\w.+-]+@[\w.-]+/g,"[email]").replace(/https?:\/\/[^\s]+/g,"[url]").replace(/[a-zA-Z0-9_-]{40,}/g,"[redacted]").replace(/\s+/g," ").slice(0,240);
      console.error("email_provider_rejected", {status: response.status, code, reason, contentType:response.headers.get("content-type")});
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
