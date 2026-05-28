import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, checkOrigin } from "@/lib/auth";
import { uploadImage } from "@/lib/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_AREAS = new Set([
  "hero",
  "gallery",
  "about",
  "general",
]);

export async function POST(req: NextRequest) {
  const adm = await requireAdmin(req);
  if (!adm.ok) return NextResponse.json({ error: adm.reason }, { status: 401 });
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const fileEntry = form.get("file");
  if (!(fileEntry instanceof Blob)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (fileEntry.size === 0) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }
  if (fileEntry.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file exceeds ${MAX_BYTES} bytes` },
      { status: 400 },
    );
  }

  const areaRaw = form.get("area");
  const area = typeof areaRaw === "string" ? areaRaw : "general";
  if (!ALLOWED_AREAS.has(area)) {
    return NextResponse.json({ error: "unknown area" }, { status: 400 });
  }

  const bytes = new Uint8Array(await fileEntry.arrayBuffer());

  try {
    const out = await uploadImage({ bytes, area });
    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("supported image type")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
