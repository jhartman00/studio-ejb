import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import GalleryForm from "../GalleryForm";

export const dynamic = "force-dynamic";

export default async function AdminGalleryNew() {
  const adm = await requireAdmin();
  if (!adm.ok) redirect("/admin/login");
  return (
    <>
      <h1>Add gallery item</h1>
      <GalleryForm />
    </>
  );
}
