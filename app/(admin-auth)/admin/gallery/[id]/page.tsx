import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getGalleryItemById } from "@/lib/db/queries";
import GalleryForm from "../GalleryForm";

export const dynamic = "force-dynamic";

export default async function AdminGalleryEdit({
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
        <h1>Add gallery item</h1>
        <GalleryForm />
      </>
    );
  }

  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();
  const item = await getGalleryItemById(id);
  if (!item) notFound();
  return (
    <>
      <h1>Edit gallery item</h1>
      <GalleryForm initial={item} />
    </>
  );
}
