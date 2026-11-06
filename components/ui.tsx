"use client";
import { useEffect, useRef, useState, ReactNode } from "react";
import { ArrowUpRight, X, Loader2, ArrowRight } from "lucide-react";
export type User = { id: string; name: string; email: string };
export async function api<T = unknown>(
  path: string,
  data?: unknown,
): Promise<T> {
  const res = await fetch("/api/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const b: unknown = await res.json();
  if (!res.ok) {
    const message =
      b && typeof b === "object" && "error" in b
        ? String(b.error)
        : "Request failed";
    throw new Error(message);
  }
  return b as T;
}
export function Brand() {
  return (
    <a className="brand" href="/" aria-label="SlotForge home">
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      slotforge<span className="brand-dot">®</span>
    </a>
  );
}
export function ArrowButton({
  children,
  onClick,
  href,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      {children}
      <span className="button-arrow">
        <ArrowUpRight size={15} />
      </span>
    </>
  );
  return href ? (
    <a className={"button dark " + className} href={href}>
      {content}
    </a>
  ) : (
    <button className={"button dark " + className} onClick={onClick}>
      {content}
    </button>
  );
}
export function Orb({ small = false }: { small?: boolean }) {
  return (
    <div className={"orb-wrap " + (small ? "small" : "")} aria-hidden="true">
      <div className="orb">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="orb-shadow" />
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      d?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function AuthModal({
  onClose,
  onSuccess,
  initialMode = 'register',
}: {
  onClose: () => void;
  onSuccess: (u: User) => void;
  initialMode?: 'register' | 'login';
}) {
  const [register, setRegister] = useState(initialMode === 'register'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={register ? "A little space for you." : "Welcome back."}
      onClose={onClose}
    >
      <p className="muted">
        {register
          ? "Create your account. Your first workspace is on us."
          : "Your next great idea is waiting."}
      </p>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const r = await api<{ user: User }>(
              "auth/" + (register ? "register" : "login"),
              Object.fromEntries(f),
            );
            onSuccess(r.user);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {register && (
          <label>
            Your name
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={60}
              placeholder="Aditya Upadhyay"
            />
          </label>
        )}
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={register ? 12 : 1}
            maxLength={128}
            placeholder={register ? "At least 12 characters" : "Your password"}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="button dark full" disabled={busy}>
          {busy ? (
            <Loader2 className="spin" size={18} />
          ) : register ? (
            "Create your workspace"
          ) : (
            "Sign in"
          )}
          <ArrowRight size={17} />
        </button>
      </form>
      <p className="auth-switch">
        {register ? "Already have an account?" : "New around here?"}{" "}
        <button
          className="text-button"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register ? "Sign in" : "Create an account"}
        </button>
      </p>
      <p className="fine-print">
        Portfolio release · Email verification and password recovery are not yet
        available. Use a unique password.
      </p>
    </Modal>
  );
}
