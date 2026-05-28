import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import TestimonialForm from "../TestimonialForm";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialNew() {
  const adm = await requireAdmin();
  if (!adm.ok) redirect("/admin/login");
  return (
    <>
      <h1>Add review</h1>
      <TestimonialForm />
    </>
  );
}
