import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import AdminBackBar from "@/components/AdminBackBar";
import GalleryForm from "../GalleryForm";

export const dynamic = "force-dynamic";

export default async function AdminGalleryNew() {
  const adm = await requireAdmin();
  if (!adm.ok) redirect("/admin/login");
  return (
    <>
      <AdminBackBar href="/admin/gallery" label="Back to gallery" />
      <h1>Add gallery item</h1>
      <GalleryForm />
    </>
  );
}
