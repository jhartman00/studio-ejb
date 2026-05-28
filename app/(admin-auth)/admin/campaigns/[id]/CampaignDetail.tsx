"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EmailCampaign } from "@/lib/db/queries";

export default function CampaignDetail({
  campaign,
  activeSubscribers,
}: {
  campaign: EmailCampaign;
  activeSubscribers: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isInFlight = campaign.status === "queued" || campaign.status === "sending";

  useEffect(() => {
    if (!isInFlight) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [isInFlight, router]);

  function resume() {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/drain`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Resume failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  const heartbeatStale = campaign.heartbeat_at
    ? Date.now() - new Date(campaign.heartbeat_at).getTime() > 5 * 60 * 1000
    : false;
  const stuck = isInFlight && heartbeatStale;

  const totalDone = campaign.success_count + campaign.failure_count;
  const pct = campaign.total_recipients
    ? Math.round((totalDone / campaign.total_recipients) * 100)
    : 0;

  return (
    <>
      <div className="section-header">
        <h1 style={{ margin: 0 }}>{campaign.subject}</h1>
        <a href="/admin/campaigns" className="btn">Back to campaigns</a>
      </div>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      {stuck ? (
        <div className="form-error" role="status">
          The drain has not made progress in over 5 minutes. Click Resume.
        </div>
      ) : null}

      <div className="admin-tiles">
        <div className="tile">
          <span className="tile-num">{campaign.total_recipients}</span>
          <span className="tile-label">Recipients</span>
        </div>
        <div className="tile">
          <span className="tile-num">{campaign.success_count}</span>
          <span className="tile-label">Sent</span>
        </div>
        <div className="tile">
          <span className="tile-num">{campaign.failure_count}</span>
          <span className="tile-label">Failed</span>
        </div>
      </div>

      <div className="section-card">
        <h3 style={{ margin: 0 }}>Status: {campaign.status}</h3>
        <div className="muted">
          {totalDone}/{campaign.total_recipients} processed ({pct}%)
        </div>
        <div
          style={{
            background: "var(--cream-50)",
            border: "1px solid var(--ink-900)",
            borderRadius: "var(--radius-card)",
            overflow: "hidden",
            height: "12px",
          }}
        >
          <div
            style={{
              background: "var(--ink-900)",
              height: "100%",
              width: `${pct}%`,
              transition: "width 200ms ease",
            }}
          />
        </div>
        {isInFlight ? (
          <p className="muted" style={{ fontSize: "var(--fs-14)" }}>
            Refreshing every few seconds. You can close this tab — the send
            keeps running in the background.
          </p>
        ) : null}
        {(stuck || campaign.status === "failed" || campaign.failure_count > 0) ? (
          <div>
            <button
              type="button"
              className="btn"
              onClick={resume}
              disabled={pending}
            >
              {pending ? "Resuming..." : "Resume / retry failed"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="section-card">
        <h3 style={{ margin: 0 }}>Preview</h3>
        <p className="muted">
          Active subscribers right now: {activeSubscribers}
        </p>
        <div
          style={{
            background: "var(--cream-50)",
            border: "1px solid var(--ink-900)",
            padding: "var(--s-16)",
            borderRadius: "var(--radius-card)",
          }}
          dangerouslySetInnerHTML={{ __html: campaign.body_html }}
        />
      </div>
    </>
  );
}
