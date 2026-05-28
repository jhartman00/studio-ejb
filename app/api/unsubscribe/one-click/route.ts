import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { bumpSubscribers } from "@/lib/cache";

// RFC 8058 one-click unsubscribe. Mail clients POST here with a token
// in the URL or body. Must succeed without user interaction.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function processToken(token: string): Promise<boolean> {
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
  let token = new URL(req.url).searchParams.get("token") || "";
  if (!token) {
    const ct = req.headers.get("content-type") || "";
    try {
      if (ct.includes("application/x-www-form-urlencoded")) {
        const form = await req.formData();
        token = String(form.get("token") ?? "");
      } else if (ct.includes("application/json")) {
        const body = await req.json().catch(() => ({}));
        token = String(body.token ?? "");
      } else {
        const text = await req.text();
        // Bare body sometimes contains "List-Unsubscribe=One-Click"; token
        // comes from the URL in that case.
        if (!token && text.includes("token=")) {
          const m = /token=([^&\s]+)/.exec(text);
          if (m) token = decodeURIComponent(m[1]!);
        }
      }
    } catch {
      // ignore
    }
  }

  await processToken(token);
  // RFC 8058 expects 200 OK regardless.
  return new NextResponse("OK", { status: 200 });
}
