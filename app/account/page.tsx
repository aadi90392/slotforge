"use client";
import { useEffect, useState } from "react";
import { api, Brand } from "@/components/ui";
export default function AccountPage() {
  const [purpose, setPurpose] = useState("forgot"),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    if (p.get("purpose") === "verify" || p.get("purpose") === "reset") {
      setPurpose(p.get("purpose")!);
      setToken(p.get("token") || "");
      window.history.replaceState(null, "", "/account");
    }
  }, []);
  return (
    <main className="account-gate">
      <Brand />
      <section className="settings-card" style={{ width: "min(100%,480px)" }}>
        <h1 style={{ fontSize: 32 }}>
          {purpose === "verify"
            ? "Verify your email"
            : purpose === "reset"
              ? "Set a new password"
              : "Forgot your password?"}
        </h1>
        <p className="muted">
          {purpose === "forgot"
            ? "Enter your account email to request a reset link."
            : "Complete this step to secure your account."}
        </p>
        {!done && (
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              try {
                if (
                  purpose === "reset" &&
                  f.get("password") !== f.get("confirm")
                )
                  throw new Error("Passwords do not match");
                const r = await api<{ message?: string }>(
                  "auth/" + (purpose === "forgot" ? "forgot" : purpose),
                  { ...Object.fromEntries(f), token },
                );
                setMessage(
                  r.message ||
                    (purpose === "verify"
                      ? "Email verified. You can now sign in."
                      : "Password reset. Sign in with your new password."),
                );
                setDone(purpose !== "forgot");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {purpose === "forgot" && (
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={180}
                  autoComplete="email"
                />
              </label>
            )}
            {purpose === "reset" && (
              <>
                <label>
                  New password
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  Confirm password
                  <input
                    name="confirm"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                  />
                </label>
              </>
            )}
            <button className="button dark full" disabled={busy}>
              {busy
                ? "Please wait..."
                : purpose === "verify"
                  ? "Verify email"
                  : purpose === "reset"
                    ? "Reset password"
                    : "Send reset link"}
            </button>
          </form>
        )}
        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <a href="/workspace">Back to sign in</a>
      </section>
    </main>
  );
}
