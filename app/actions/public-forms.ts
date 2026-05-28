"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db";
import { bumpSubscribers } from "@/lib/cache";
import { ipFromHeaders, rateLimit } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email/client";

const MIN_RESPONSE_MS = 250;

async function pad(started: number) {
  const elapsed = Date.now() - started;
  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise<void>((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
  }
}

export type SubscribeState = {
  ok?: boolean;
  done?: boolean;
  error?: string;
};

const subscribeSchema = z.object({
  email: z.string().email().max(254),
  source: z.string().max(64).optional(),
});

export async function subscribeAction(
  _prev: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  const started = Date.now();
  try {
    const h = await headers();
    const ip = ipFromHeaders(h);

    const honeypot = formData.get("website");
    if (typeof honeypot === "string" && honeypot.length > 0) {
      await pad(started);
      return { ok: true, done: true };
    }

    const limit = await rateLimit({
      bucket: "subscribe",
      identifier: ip,
      windowSec: 60,
      max: 10,
    });
    if (!limit.ok) {
      await pad(started);
      return { error: "Too many tries. Please wait a minute." };
    }

    const parsed = subscribeSchema.safeParse({
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      source: formData.get("source") ? String(formData.get("source")) : undefined,
    });
    if (!parsed.success) {
      await pad(started);
      return { error: "Please enter a valid email address." };
    }

    // Always generate a token; discard if not inserted. Prevents timing
    // enumeration on duplicate emails.
    const token = randomBytes(32).toString("base64url");
    await sql`
      insert into email_subscribers (email, source, unsubscribe_token)
      values (${parsed.data.email}, ${parsed.data.source ?? null}, ${token})
      on conflict (email) do nothing
    `;

    bumpSubscribers();
  } catch (e) {
    console.error("[subscribe] unexpected error", e);
  }
  await pad(started);
  return { ok: true, done: true };
}

export type ContactState = {
  ok?: boolean;
  done?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const contactSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(120)
    .refine((s) => !/[\r\n]/.test(s), "no line breaks in name"),
  email: z
    .string()
    .email()
    .max(254)
    .refine((s) => !/[\r\n]/.test(s), "no line breaks in email"),
  message: z.string().min(1).max(5000),
  ref: z
    .string()
    .max(64)
    .regex(/^[a-z0-9-]*$/i, "bad ref")
    .optional(),
});

export async function contactAction(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const h = await headers();
  const ip = ipFromHeaders(h);

  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.length > 0) {
    return { ok: true, done: true };
  }

  const limit = await rateLimit({
    bucket: "contact",
    identifier: ip,
    windowSec: 60,
    max: 5,
  });
  if (!limit.ok) {
    return { error: "Too many tries. Please wait a minute." };
  }

  const parsed = contactSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    message: String(formData.get("message") ?? "").trim(),
    ref: formData.get("ref") ? String(formData.get("ref")) : undefined,
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fe[issue.path.join(".") || "_"] = issue.message;
    }
    return { error: "Please check your entries.", fieldErrors: fe };
  }

  const { name, email, message, ref } = parsed.data;

  try {
    await sql`
      insert into contact_messages (name, email, message, ref)
      values (${name}, ${email}, ${message}, ${ref ?? null})
    `;
  } catch (e) {
    console.error("[contact] db error", e);
    return { error: "Could not save your message. Try again later." };
  }

  const to = process.env.EMMA_EMAIL;
  if (to) {
    const res = await sendEmail({
      to,
      // Subject: only the verified name. No newlines (validated above)
      // so header injection is impossible.
      subject: `New contact from ${name}`,
      replyTo: email,
      text: `From: ${name} <${email}>\nRef: ${ref ?? "(none)"}\n\n${message}`,
    });
    if (!res.ok) {
      console.warn("[contact] email send failed", res.error);
      // Still return success: the row is saved; Emma can see it in DB.
    }
  }

  return { ok: true, done: true };
}
