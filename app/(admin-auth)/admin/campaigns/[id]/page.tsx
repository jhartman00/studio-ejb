import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getCampaignById } from "@/lib/db/queries";
import { sql } from "@/lib/db";
import { isPlaceholderAddress } from "@/lib/email/templates";
import AdminBackBar from "@/components/AdminBackBar";
import CampaignComposer from "../CampaignComposer";
import CampaignDetail from "./CampaignDetail";

export const dynamic = "force-dynamic";

export default async function AdminCampaignDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const adm = await requireAdmin();
  if (!adm.ok) redirect("/admin/login");
  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const blocked = isPlaceholderAddress(process.env.STUDIO_MAILING_ADDRESS);
  const noResend = !process.env.RESEND_API_KEY;

  const { rows: activeCount } = await sql<{ c: string }>`
    select count(*)::text as c from email_subscribers where status = 'active'
  `;
  const activeSubs = Number(activeCount[0]?.c ?? "0");

  if (campaign.status === "draft" || campaign.status === "failed") {
    return (
      <>
        <AdminBackBar href="/admin/campaigns" label="Back to campaigns" />
        <CampaignComposer
          initial={{
            id: campaign.id,
            subject: campaign.subject,
            preheader: campaign.preheader,
            body_html: campaign.body_html,
          }}
          activeSubscribers={activeSubs}
          sendBlockedReason={
            blocked
              ? "STUDIO_MAILING_ADDRESS missing or placeholder"
              : noResend
                ? "RESEND_API_KEY missing"
                : null
          }
        />
      </>
    );
  }

  return (
    <>
      <AdminBackBar href="/admin/campaigns" label="Back to campaigns" />
      <CampaignDetail
        campaign={campaign}
        activeSubscribers={activeSubs}
      />
    </>
  );
}
