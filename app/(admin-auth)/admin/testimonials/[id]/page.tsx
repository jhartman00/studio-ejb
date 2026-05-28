import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { Testimonial } from "@/lib/db/queries";
import TestimonialForm from "../TestimonialForm";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialEdit({
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
        <h1>Add review</h1>
        <TestimonialForm />
      </>
    );
  }
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();
  const { rows } = await sql<Testimonial>`
    select id, quote, attribution, location, source_label, display_order, is_published
    from testimonials where id = ${id}
  `;
  const item = rows[0];
  if (!item) notFound();
  return (
    <>
      <h1>Edit review</h1>
      <TestimonialForm initial={item} />
    </>
  );
}
