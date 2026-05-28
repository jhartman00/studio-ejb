import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin, checkOrigin } from "@/lib/auth";

// Dev-only Phase 3.5 verification hook.
// POST /api/admin/_dev/bump-cache?tag=site_content:home
// Returns 404 in production. Cookie + origin gated like other admin endpoints.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("not found", { status: 404 });
  }
  const adm = await requireAdmin(req);
  if (!adm.ok) return NextResponse.json({ error: adm.reason }, { status: 401 });
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }
  const url = new URL(req.url);
  const tag = url.searchParams.get("tag");
  if (!tag) {
    return NextResponse.json({ error: "missing ?tag=" }, { status: 400 });
  }
  revalidateTag(tag);
  return NextResponse.json({ ok: true, tag });
}
