import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@vercel/postgres";
import { requireAdmin, checkOrigin } from "@/lib/auth";

// Run with: POST /api/admin/migrate?confirm=1
//   - cookie-gated (requireAdmin)
//   - Origin must match deployment host
//   - Optional ?force=1 in non-production to re-run already-applied migrations
//
// Idempotent: re-running on a current DB is a no-op. Wraps in a tx and
// takes pg_advisory_xact_lock(42) to serialize concurrent runs.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");
// e.g. "0001_init.sql" -> version 1
const FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/i;

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.reason }, { status: 401 });
  }
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get("confirm") !== "1") {
    return NextResponse.json(
      { error: "missing ?confirm=1" },
      { status: 400 },
    );
  }
  const force = url.searchParams.get("force") === "1";
  if (force && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "force not allowed in production" },
      { status: 400 },
    );
  }

  let files: string[];
  try {
    files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((f) => FILE_PATTERN.test(f))
      .sort();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `cannot read migrations dir: ${msg}` },
      { status: 500 },
    );
  }

  const client = await db.connect();
  const applied: number[] = [];
  const skipped: number[] = [];
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(42)");

    // Bootstrap the registry table itself so first-ever run can record.
    await client.query(`
      create table if not exists schema_migrations (
        version    integer primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const existing = await client.query<{ version: number }>(
      "select version from schema_migrations",
    );
    const appliedSet = new Set(existing.rows.map((r) => r.version));

    for (const file of files) {
      const m = FILE_PATTERN.exec(file);
      if (!m) continue;
      const version = parseInt(m[1]!, 10);
      const already = appliedSet.has(version);
      if (already && !force) {
        skipped.push(version);
        continue;
      }
      const sqlText = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query(sqlText);
      if (!already) {
        await client.query(
          "insert into schema_migrations (version) values ($1) on conflict do nothing",
          [version],
        );
      }
      applied.push(version);
    }

    await client.query("commit");
    return NextResponse.json({ ok: true, applied, skipped, force });
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      // ignore
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
