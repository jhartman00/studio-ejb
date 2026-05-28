import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, checkOrigin } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeCsv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n") || v.includes("\r")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export async function GET(req: NextRequest) {
  const adm = await requireAdmin(req);
  if (!adm.ok) return NextResponse.json({ error: adm.reason }, { status: 401 });
  // GET is technically same-site by SameSite=Strict cookie, but check origin/referer
  // anyway for defense in depth.
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }

  const { rows } = await sql<{
    email: string;
    status: string;
    source: string | null;
    subscribed_at: string;
    unsubscribed_at: string | null;
  }>`
    select email, status, source, subscribed_at, unsubscribed_at
    from email_subscribers
    order by subscribed_at desc
  `;

  const header = ["email", "status", "source", "subscribed_at", "unsubscribed_at"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        escapeCsv(r.email),
        escapeCsv(r.status),
        escapeCsv(r.source || ""),
        escapeCsv(r.subscribed_at),
        escapeCsv(r.unsubscribed_at || ""),
      ].join(","),
    );
  }
  const body = lines.join("\n") + "\n";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="studio-ejb-subscribers-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
