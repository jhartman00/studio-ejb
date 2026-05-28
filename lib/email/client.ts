import { Resend } from "resend";

let cached: Resend | null = null;

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (cached) return cached;
  cached = new Resend(key);
  return cached;
}

export function defaultFrom(): string {
  return process.env.RESEND_FROM || "Studio EJB <onboarding@resend.dev>";
}

// Wraps Resend.emails.send so callers don't have to handle the missing-key
// case at every callsite. In dev/preview without RESEND_API_KEY we log
// the payload to stdout and return a fake message id so the caller's
// flow still proceeds (subscribe / contact success swap-out still
// renders). Real campaign send routes return a typed error and refuse
// to send without a key.
export type SendArgs = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  from?: string;
  idempotencyKey?: string;
};

export type SendResult =
  | { ok: true; id: string; stubbed?: boolean }
  | { ok: false; error: string };

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY missing; logging instead of sending", {
      to: args.to,
      subject: args.subject,
    });
    return { ok: true, id: `stub_${Date.now()}`, stubbed: true };
  }
  if (!args.text && !args.html) {
    return { ok: false, error: "either text or html must be provided" };
  }
  try {
    const payload = {
      from: args.from || defaultFrom(),
      to: args.to,
      subject: args.subject,
      text: args.text ?? "",
      html: args.html,
      replyTo: args.replyTo,
      headers: args.headers,
    };
    const res = await resend.emails.send(
      payload,
      args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : undefined,
    );
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true, id: res.data?.id ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
