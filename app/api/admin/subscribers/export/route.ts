import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, checkOrigin } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeCsv(v: unknown): string {
  // Coerce non-string values (Date from timestamptz, null, numbers) to a
  // stable string representation. Date -> ISO 8601; null/undefined -> empty.
  let s: string;
  if (v === null || v === undefined) {
    s = "";
  } else if (v instanceof Date) {
    s = v.toISOString();
  } else if (typeof v === "string") {
    s = v;
  } else {
    s = String(v);
  }
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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
    subscribed_at: Date | string;
    unsubscribed_at: Date | string | null;
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
        escapeCsv(r.source),
        escapeCsv(r.subscribed_at),
        escapeCsv(r.unsubscribed_at),
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
