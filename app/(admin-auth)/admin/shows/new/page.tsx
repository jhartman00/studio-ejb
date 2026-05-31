import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import AdminBackBar from "@/components/AdminBackBar";
import ShowForm from "../ShowForm";

export const dynamic = "force-dynamic";

export default async function AdminShowNew() {
  const adm = await requireAdmin();
  if (!adm.ok) redirect("/admin/login");
  return (
    <>
      <AdminBackBar href="/admin/shows" label="Back to shows" />
      <h1>Add show</h1>
      <ShowForm />
    </>
  );
}
