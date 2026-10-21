import { NextResponse } from "next/server";

// The footer's "Subscribe" box posts here. The job is only to get the visitor's address into our
// inbox so we can reach out later — nothing is stored on our side.
//
// Delivery is provider-agnostic and picked up from the environment, so no key ever lives in the
// repo (see .env.example):
//   WEB3FORMS_ACCESS_KEY — simplest route: web3forms.com forwards the submission to whatever
//                          address the key was created for. No domain verification, no account.
//   RESEND_API_KEY       — alternative: a real transactional send, needs SUBSCRIBE_TO and
//                          (for a custom From) a verified domain on resend.com.
// With neither set the route still answers 200 and logs the address to the server console, so the
// UI can be developed and tested before the key exists.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TO = process.env.SUBSCRIBE_TO ?? "hello@usectl.com";
const FROM = process.env.SUBSCRIBE_FROM ?? "onboarding@resend.dev";

// --- the "don't send it 100 times" plan -------------------------------------------------------
// Three independent layers; the client has two more (a disabled button while in flight and a
// localStorage guard), but those protect an honest visitor, not an attacker, so the real limits
// live here:
//   1. per-IP burst limit  — at most MAX_PER_IP accepted submissions per hour from one address;
//   2. per-email dedupe    — the same address is forwarded once per DEDUPE_MS, further tries get
//                            a friendly 200 WITHOUT a second email;
//   3. a honeypot field    — bots fill every input they see; a filled "company" field is answered
//                            like a success and dropped silently.
// The maps are per server instance and reset on redeploy (and are per-lambda on serverless) —
// fine for a landing-page form; move to a shared store (KV/Redis) if this ever needs to be exact.
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_IP = 3;
const DEDUPE_MS = 24 * 60 * 60 * 1000; // 1 day
const MAX_ENTRIES = 5000; // hard ceiling so the maps can't grow without bound

const ipHits = new Map<string, number[]>();
const emailSeen = new Map<string, number>();

function prune(now: number) {
  for (const [ip, hits] of ipHits) {
    const fresh = hits.filter((t) => now - t < WINDOW_MS);
    if (fresh.length) ipHits.set(ip, fresh);
    else ipHits.delete(ip);
  }
  for (const [email, t] of emailSeen) {
    if (now - t > DEDUPE_MS) emailSeen.delete(email);
  }
  // paranoia: if something still blew the maps up, drop the oldest half
  if (ipHits.size > MAX_ENTRIES) ipHits.clear();
  if (emailSeen.size > MAX_ENTRIES) emailSeen.clear();
}

function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Deliberately loose — the point is to catch typos, not to re-implement RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

type Payload = { email?: unknown; consent?: unknown; company?: unknown };

async function deliver(email: string, consent: boolean) {
  const subject = `usectl landing — new subscriber: ${email}`;
  const lines = [
    `Email: ${email}`,
    `Terms accepted: ${consent ? "yes" : "no"}`,
    `Source: usectl.com footer subscribe form`,
  ];

  const web3 = process.env.WEB3FORMS_ACCESS_KEY;
  if (web3) {
    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: web3,
        subject,
        from_name: "usectl landing",
        email, // shows up as the reply-to address
        message: lines.join("\n"),
      }),
    });
    if (!res.ok) throw new Error(`web3forms ${res.status}`);
    return "web3forms";
  }

  const resend = process.env.RESEND_API_KEY;
  if (resend) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resend}` },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject,
        text: lines.join("\n"),
      }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}`);
    return "resend";
  }

  console.warn(`[subscribe] no mail provider configured — would send to ${TO}:\n${lines.join("\n")}`);
  return "logged";
}

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  // honeypot: a real visitor never sees this field
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ ok: true, dropped: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
  }

  // the terms box is required (the UI refuses first; this is the backstop for anything posting
  // straight at the endpoint)
  if (body.consent !== true) {
    return NextResponse.json({ ok: false, error: "consent-required" }, { status: 400 });
  }

  const now = Date.now();
  prune(now);

  const ip = clientIp(req);
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_IP) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  // already forwarded recently → answer like a success, send nothing
  const last = emailSeen.get(email);
  if (last !== undefined && now - last < DEDUPE_MS) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    const via = await deliver(email, body.consent === true);
    emailSeen.set(email, now);
    ipHits.set(ip, [...hits, now]);
    return NextResponse.json({ ok: true, via });
  } catch (err) {
    console.error("[subscribe] delivery failed", err);
    return NextResponse.json({ ok: false, error: "send-failed" }, { status: 502 });
  }
}
