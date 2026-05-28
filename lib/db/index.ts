import { sql as vercelSql, db as vercelDb } from "@vercel/postgres";

// Tagged template. Use for all queries. Interpolated values are bound
// as parameters; concatenated SQL is impossible by construction.
export const sql = vercelSql;

// Dynamic SQL escape hatch. Caller must pass parameters separately;
// never concatenate user input into `text`.
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; rowCount: number }> {
  const client = await vercelDb.connect();
  try {
    const res = await client.query(text, params as unknown[]);
    return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
  } finally {
    client.release();
  }
}

// Transaction helper. Caller must use the passed client for queries.
// Errors roll back. Returns the callback's return value.
export async function transaction<T>(
  fn: (tx: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
  }) => Promise<T>,
): Promise<T> {
  const client = await vercelDb.connect();
  try {
    await client.query("begin");
    const result = await fn({
      query: async (text, params = []) => {
        const r = await client.query(text, params as unknown[]);
        return { rows: r.rows as Record<string, unknown>[], rowCount: r.rowCount ?? 0 };
      },
    });
    await client.query("commit");
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      // ignore
    }
    throw err;
  } finally {
    client.release();
  }
}
