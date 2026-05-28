import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { TradeShow } from "@/lib/db/queries";
import ShowForm from "../ShowForm";

export const dynamic = "force-dynamic";

export default async function AdminShowEdit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const adm = await requireAdmin();
  if (!adm.ok) redirect("/admin/login");
  const { id: idParam } = await params;
  if (idParam === "new") {
    return (
      <>
        <h1>Add show</h1>
        <ShowForm />
      </>
    );
  }
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();
  const { rows } = await sql<TradeShow>`
    select id, name, city, venue, booth, starts_at, ends_at, url, notes, is_published
    from trade_shows where id = ${id}
  `;
  const show = rows[0];
  if (!show) notFound();
  return (
    <>
      <h1>Edit show</h1>
      <ShowForm initial={show} />
    </>
  );
}
