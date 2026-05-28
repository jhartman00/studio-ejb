import { NextResponse, type NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { requireAdmin, checkOrigin, ADMIN_COOKIE_NAME } from "@/lib/auth";
import { drainOnce } from "@/lib/email/campaigns";
import { bumpCampaigns } from "@/lib/cache";
import { isPlaceholderAddress } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const adm = await requireAdmin(req);
  if (!adm.ok) return NextResponse.json({ error: adm.reason }, { status: 401 });
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }

  const { id: idParam } = await ctx.params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const addr = process.env.STUDIO_MAILING_ADDRESS || "";
  if (isPlaceholderAddress(addr)) {
    return NextResponse.json(
      { error: "STUDIO_MAILING_ADDRESS not configured" },
      { status: 400 },
    );
  }

  let result: { processed: number; remaining: number };
  try {
    result = await drainOnce({ campaignId: id, studioMailingAddress: addr });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
  bumpCampaigns();

  if (result.remaining > 0) {
    const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const drainUrl = new URL(`/api/admin/campaigns/${id}/drain`, req.url);
    waitUntil(
      fetch(drainUrl.toString(), {
        method: "POST",
        headers: cookie
          ? {
              cookie: `${ADMIN_COOKIE_NAME}=${cookie}`,
              "x-forwarded-host": req.headers.get("host") ?? "",
              origin: req.nextUrl.origin,
            }
          : { origin: req.nextUrl.origin },
      }).catch((err) => console.error("[drain] self-schedule failed", err)),
    );
  }

  return NextResponse.json({
    processed: result.processed,
    remaining: result.remaining,
  });
}
