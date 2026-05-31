import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import AdminBackBar from "@/components/AdminBackBar";
import CampaignComposer from "../CampaignComposer";

export const dynamic = "force-dynamic";

export default async function AdminCampaignNew() {
  const adm = await requireAdmin();
  if (!adm.ok) redirect("/admin/login");
  return (
    <>
      <AdminBackBar href="/admin/campaigns" label="Back to campaigns" />
      <h1>New campaign</h1>
      <CampaignComposer />
    </>
  );
}
