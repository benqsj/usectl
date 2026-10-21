"use client";

import { useMemo, useRef, useState } from "react";
import { s } from "@/lib/grid";

// The footer's subscribe box (desktop + phone share this one component — `variant` only picks the
// scale variable, `--s` for the 1920 canvas or `--m` for the phone one, so the markup can't drift).
//
// Behaviour asked for (2026-10-21): the send icon only APPEARS once what's typed looks like an
// address, Enter submits just like the icon, and the address is posted to /api/subscribe which
// forwards it to our inbox.
//
// Not sending it a hundred times is handled in three places here (the server has its own, stricter
// limits — per-IP, per-email and a honeypot):
//   · the button is disabled while a request is in flight;
//   · after a success the field locks and the form is done;
//   · a localStorage ledger remembers which addresses this browser already sent (24h) and enforces
//     a short cooldown between sends, so a reload can't be used to spam the endpoint either.

const STORE_KEY = "usectl:subscribe:v1";
const REMEMBER_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;

// same loose check as the server's — catches typos, doesn't try to be RFC 5322
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

type Ledger = { sent: Record<string, number>; last: number };

function readLedger(): Ledger {
  if (typeof window === "undefined") return { sent: {}, last: 0 };
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return { sent: {}, last: 0 };
    const parsed = JSON.parse(raw) as Partial<Ledger>;
    return { sent: parsed.sent ?? {}, last: parsed.last ?? 0 };
  } catch {
    return { sent: {}, last: 0 };
  }
}

function writeLedger(email: string) {
  try {
    const now = Date.now();
    const { sent } = readLedger();
    for (const [key, at] of Object.entries(sent)) {
      if (now - at > REMEMBER_MS) delete sent[key];
    }
    sent[email] = now;
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ sent, last: now } satisfies Ledger));
  } catch {
    // private mode / storage disabled — the server-side limits still apply
  }
}

type Status = "idle" | "sending" | "done" | "error";

export function SubscribeForm({ variant }: { variant: "desktop" | "mobile" }) {
  const desktop = variant === "desktop";
  // the phone footer scales with --m, the desktop canvas with --s (= `s()` from lib/grid)
  const u = useMemo(() => (desktop ? s : (px: number) => `calc(var(--m) * ${px})`), [desktop]);

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const company = useRef<HTMLInputElement>(null); // honeypot

  // `ready` = the icon is shown (the address looks complete); CONSENT is required on top of that
  // before anything leaves the browser — an unticked box dims the icon and only explains itself
  // when the visitor tries to send (clicking a disabled button fires no event at all, so the
  // button stays enabled and submit() does the refusing).
  const ready = EMAIL_RE.test(email.trim());
  const live = ready && status !== "sending" && status !== "done";
  const canSend = live && consent;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); // Enter must not reload the page
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value) || status === "sending" || status === "done") return;

    if (!consent) {
      setStatus("error");
      setMessage("Please accept the terms and conditions first.");
      return;
    }

    // local guard first — a repeat of the same address never leaves the browser
    const ledger = readLedger();
    const now = Date.now();
    if (ledger.sent[value] !== undefined && now - ledger.sent[value]! < REMEMBER_MS) {
      setStatus("done");
      setMessage("You're already on the list — we'll be in touch.");
      return;
    }
    if (now - ledger.last < COOLDOWN_MS) {
      setStatus("error");
      setMessage("Just a moment — try again in a minute.");
      return;
    }

    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, consent, company: company.current?.value ?? "" }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(
          data.error === "rate-limited"
            ? "Too many tries — please come back later."
            : data.error === "invalid-email"
              ? "That address doesn't look right."
              : data.error === "consent-required"
                ? "Please accept the terms and conditions first."
                : "Couldn't send it. Please try again.",
        );
        return;
      }
      writeLedger(value);
      setStatus("done");
      setMessage("Thanks — we'll be in touch.");
    } catch {
      setStatus("error");
      setMessage("Couldn't send it. Please try again.");
    }
  }

  const inputH = desktop ? 42 : 44;
  const iconBox = desktop ? 30 : 32;

  return (
    // the FIELD is the 232-wide one on desktop; the form itself must stay unconstrained or the
    // consent label (one line in the design) wraps
    <form onSubmit={submit} noValidate style={{ width: desktop ? "auto" : "100%" }}>
      <div className="relative" style={{ marginTop: u(desktop ? 24 : 14), width: desktop ? u(232) : "100%" }}>
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="email"
          value={email}
          disabled={status === "done"}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") {
              setStatus("idle");
              setMessage("");
            }
          }}
          className="block w-full rounded-lg border border-white/15 bg-transparent font-heading font-light text-white/80 outline-none transition-colors placeholder:text-white/30 focus:border-white/35 disabled:opacity-60"
          style={{
            height: u(inputH),
            paddingLeft: u(14),
            // room for the icon once it's there, so the text never slides under it
            paddingRight: ready && status !== "done" ? u(iconBox + 16) : u(14),
            fontSize: desktop ? u(14) : 16, // 16px on phones: anything smaller zooms iOS Safari in
          }}
        />

        {/* the send icon: fades/slides in once the address looks complete, and stays DIMMED until
            the terms box is ticked (it still takes the click — see submit()) */}
        <button
          type="submit"
          aria-label="Send"
          // deliberately NOT disabled / aria-disabled when the box is unticked: the click is what
          // produces the "accept the terms first" hint, and a disabled control fires no events
          // (and would read as dead to a screen reader with nothing to explain why)
          tabIndex={live ? 0 : -1}
          className={`absolute flex items-center justify-center rounded-md border transition-all duration-200 ${
            live ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          } ${
            canSend || status === "sending"
              ? "border-white/20 text-white/70 hover:border-brand hover:text-brand"
              : "cursor-not-allowed border-white/10 text-white/25"
          }`}
          style={{
            top: "50%",
            right: u(6),
            width: u(iconBox),
            height: u(iconBox),
            transform: `translateY(-50%) translateX(${live ? "0px" : u(6)})`,
          }}
        >
          {status === "sending" ? (
            <span
              className="block animate-spin rounded-full border-2 border-white/25 border-t-brand"
              style={{ width: u(14), height: u(14) }}
            />
          ) : (
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ width: u(16), height: u(16) }}>
              <path
                d="M3.5 10h11M10 5l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        {/* honeypot — hidden from people, irresistible to bots */}
        <input
          ref={company}
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      </div>

      <label
        className="flex cursor-pointer items-center font-heading font-light text-white/60"
        style={{
          marginTop: u(desktop ? 18 : 14),
          gap: u(9),
          fontSize: u(desktop ? 14.5 : 13.5),
          whiteSpace: desktop ? "nowrap" : "normal",
        }}
      >
        {/* the native box rendered as a heavy solid square in dark mode — this is the design's
            own shape instead: a thin-bordered rounded square that fills green when checked */}
        <span className="relative inline-block shrink-0" style={{ width: u(desktop ? 15 : 16), height: u(desktop ? 15 : 16) }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              // ticking it answers the "please accept the terms" hint — drop it right away
              if (e.target.checked && status === "error") {
                setStatus("idle");
                setMessage("");
              }
            }}
            className="peer absolute inset-0 m-0 cursor-pointer appearance-none border border-white/25 bg-transparent transition-colors checked:border-brand checked:bg-brand"
            style={{ borderRadius: u(4) }}
          />
          <svg
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden h-full w-full peer-checked:block"
          >
            <path d="M3 6.2 5.1 8.3 9 4.2" stroke="#1e1d1d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        I agree to the terms and conditions.
      </label>

      {message ? (
        <p
          role="status"
          className={`font-heading font-light ${status === "error" ? "text-[#ff8e8e]" : "text-brand"}`}
          style={{ marginTop: u(10), fontSize: u(desktop ? 13.5 : 13), maxWidth: desktop ? u(300) : "100%" }}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
