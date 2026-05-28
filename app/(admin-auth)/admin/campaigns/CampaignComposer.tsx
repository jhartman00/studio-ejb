"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import RichText from "@/components/RichText";
import {
  campaignDraftAction,
  campaignTestSendAction,
} from "@/app/actions/campaigns";

type Initial = {
  id?: number;
  subject?: string;
  preheader?: string | null;
  body_html?: string;
};

export default function CampaignComposer({
  initial,
  activeSubscribers,
  sendBlockedReason,
}: {
  initial?: Initial;
  activeSubscribers?: number;
  sendBlockedReason?: string | null;
}) {
  const [id, setId] = useState<number | null>(initial?.id ?? null);
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [preheader, setPreheader] = useState(initial?.preheader ?? "");
  const [bodyHtml, setBodyHtml] = useState(initial?.body_html ?? "");
  const [testEmail, setTestEmail] = useState("");

  const [saveError, setSaveError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testSucceeded, setTestSucceeded] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [typedSend, setTypedSend] = useState("");
  const [confirmedTest, setConfirmedTest] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [pending, start] = useTransition();
  const router = useRouter();

  function saveDraft(then?: (id: number) => void) {
    setSaveError(null);
    start(async () => {
      const res = await campaignDraftAction({
        id,
        subject,
        preheader: preheader || null,
        body_html: bodyHtml,
      });
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      setId(res.id);
      router.refresh();
      then?.(res.id);
    });
  }

  function sendTest() {
    setTestStatus(null);
    if (!id) {
      setTestStatus("Save the draft first.");
      return;
    }
    if (!testEmail) {
      setTestStatus("Enter an email address for the test send.");
      return;
    }
    start(async () => {
      const res = await campaignTestSendAction({ id, toEmail: testEmail });
      if (!res.ok) {
        setTestStatus(`Test send failed: ${res.error}`);
        setTestSucceeded(false);
        return;
      }
      setTestStatus(`Test sent to ${testEmail}. Check that address.`);
      setTestSucceeded(true);
    });
  }

  async function realSend() {
    if (!id) return;
    setSendError(null);
    const res = await fetch(`/api/admin/campaigns/${id}/send`, {
      method: "POST",
      headers: { "x-csrf-defense": "1" },
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setSendError(j.error || `Send failed (${res.status})`);
      return;
    }
    router.push(`/admin/campaigns/${id}`);
    router.refresh();
  }

  const canOpenSend = Boolean(
    id && subject && bodyHtml && testSucceeded && !sendBlockedReason,
  );

  return (
    <div className="editor-shell">
      {saveError ? <div className="form-error" role="alert">{saveError}</div> : null}
      {sendBlockedReason ? (
        <div className="form-error" role="status">
          Send is blocked: {sendBlockedReason}. Update Vercel env vars and reload.
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="c-subject">Subject</label>
        <input
          id="c-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="c-preheader">Preheader (preview text in the inbox)</label>
        <input
          id="c-preheader"
          type="text"
          value={preheader ?? ""}
          onChange={(e) => setPreheader(e.target.value)}
          maxLength={300}
        />
      </div>
      <div className="field">
        <label>Body</label>
        <RichText
          value={bodyHtml}
          onChange={setBodyHtml}
          ariaLabel="Campaign body"
        />
      </div>

      <div style={{ display: "flex", gap: "var(--s-12)", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn"
          onClick={() => saveDraft()}
          disabled={pending || !subject || !bodyHtml}
        >
          {pending ? "Saving..." : id ? "Save changes" : "Save draft"}
        </button>
        <a href="/admin/campaigns" className="btn btn-danger">Cancel</a>
      </div>

      <div className="section-card">
        <h3 style={{ margin: 0 }}>Send a test to yourself</h3>
        <p className="muted" style={{ fontSize: "var(--fs-14)" }}>
          You must send and verify a test before the real send button unlocks.
        </p>
        <div style={{ display: "flex", gap: "var(--s-12)" }}>
          <input
            className="input"
            type="email"
            value={testEmail}
            placeholder="you@example.com"
            onChange={(e) => setTestEmail(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!id) {
                saveDraft((newId) => {
                  void campaignTestSendAction({ id: newId, toEmail: testEmail });
                });
              } else {
                sendTest();
              }
            }}
            disabled={pending || !testEmail || !subject || !bodyHtml}
          >
            Send test
          </button>
        </div>
        {testStatus ? <div className="muted">{testStatus}</div> : null}
      </div>

      <div className="section-card">
        <h3 style={{ margin: 0 }}>Send to all active subscribers</h3>
        <p className="muted" style={{ fontSize: "var(--fs-14)" }}>
          {activeSubscribers ?? 0} active subscriber
          {activeSubscribers === 1 ? "" : "s"} will receive this.
        </p>
        {sendError ? <div className="form-error" role="alert">{sendError}</div> : null}
        <button
          type="button"
          className="btn"
          disabled={!canOpenSend || pending}
          onClick={() => setSendModal(true)}
        >
          Send for real
        </button>
        {!testSucceeded ? (
          <p className="muted" style={{ fontSize: "var(--fs-13)" }}>
            Send a test first.
          </p>
        ) : null}
      </div>

      {sendModal && id ? (
        <div className="gallery-modal" onClick={() => setSendModal(false)}>
          <div className="gallery-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Send this campaign?</h2>
            <p>
              Subject: <strong>{subject}</strong>
            </p>
            <p>{activeSubscribers ?? 0} recipients.</p>
            <p className="muted">
              The send runs in the background. You will see live progress on
              the campaign page.
            </p>
            <label className="checkbox-row" style={{ marginTop: "var(--s-16)" }}>
              <input
                type="checkbox"
                checked={confirmedTest}
                onChange={(e) => setConfirmedTest(e.target.checked)}
              />
              I sent a test and it looked right.
            </label>
            <div className="field" style={{ marginTop: "var(--s-12)" }}>
              <label htmlFor="type-send">Type SEND to confirm</label>
              <input
                id="type-send"
                type="text"
                value={typedSend}
                onChange={(e) => setTypedSend(e.target.value)}
                placeholder="SEND"
              />
            </div>
            <div style={{ display: "flex", gap: "var(--s-12)", marginTop: "var(--s-16)" }}>
              <button
                type="button"
                className="btn"
                disabled={typedSend !== "SEND" || !confirmedTest}
                onClick={() => {
                  setSendModal(false);
                  void realSend();
                }}
              >
                Send now
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setSendModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
