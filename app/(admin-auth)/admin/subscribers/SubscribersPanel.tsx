"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  subscriberAddAction,
  subscriberSuppressAction,
} from "@/app/actions/subscribers";

type Row = {
  id: number;
  email: string;
  status: string;
  source: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
};

export default function SubscribersPanel({
  subscribers,
}: {
  subscribers: Row[];
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function addManual() {
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await subscriberAddAction({ email, source: "manual" });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEmail("");
      setInfo("Added.");
      router.refresh();
    });
  }

  function suppress(id: number, addr: string) {
    if (!window.confirm(`Unsubscribe ${addr}?`)) return;
    setError(null);
    start(async () => {
      const res = await subscriberSuppressAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="editor-shell">
      <div className="section-card">
        <h3 style={{ margin: 0 }}>Add subscriber by hand</h3>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        {info ? <div className="muted">{info}</div> : null}
        <div style={{ display: "flex", gap: "var(--s-12)" }}>
          <input
            className="input"
            type="email"
            value={email}
            placeholder="name@example.com"
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn"
            onClick={addManual}
            disabled={pending || !email}
          >
            {pending ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      {subscribers.length === 0 ? (
        <div className="empty-state">
          <p>No subscribers yet.</p>
        </div>
      ) : (
        <div className="admin-list">
          {subscribers.map((s) => (
            <div key={s.id} className="admin-list-card">
              <div style={{ flex: 1 }}>
                <strong>{s.email}</strong>
                <div className="meta">
                  {s.status} · {s.source || "—"}
                </div>
                <div className="meta">
                  Joined {new Date(s.subscribed_at).toLocaleDateString()}
                  {s.unsubscribed_at
                    ? ` · Off ${new Date(s.unsubscribed_at).toLocaleDateString()}`
                    : ""}
                </div>
                {s.status === "active" ? (
                  <div className="actions">
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => suppress(s.id, s.email)}
                      disabled={pending}
                    >
                      Unsubscribe
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
