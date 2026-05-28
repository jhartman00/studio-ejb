import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { bumpSubscribers } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function processToken(token: string) {
  if (!token || token.length < 8 || token.length > 200) return false;
  try {
    const result = await sql`
      update email_subscribers
      set status = 'unsubscribed', unsubscribed_at = now()
      where unsubscribe_token = ${token}
        and status != 'unsubscribed'
    `;
    if ((result.rowCount ?? 0) > 0) bumpSubscribers();
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let token = "";
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form = await req.formData();
      token = String(form.get("token") ?? "");
    } else {
      const body = await req.json().catch(() => ({}));
      token = String(body.token ?? "");
    }
  } catch {
    // ignore
  }

  const ok = await processToken(token);

  // Redirect to the confirmation page in either case (don't leak which
  // tokens are valid via status code).
  const base = new URL(req.url);
  const redirect = new URL("/unsubscribe", base);
  redirect.searchParams.set("done", "1");
  if (!ok) {
    // Still 200; user-friendly page renders generic confirmation.
    return NextResponse.redirect(redirect, 303);
  }
  return NextResponse.redirect(redirect, 303);
}
