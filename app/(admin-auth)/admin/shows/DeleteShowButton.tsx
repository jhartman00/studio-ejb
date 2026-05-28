"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { showDeleteAction } from "@/app/actions/shows";

export default function DeleteShowButton({
  id,
  name,
}: {
  id: number;
  name: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      className="btn btn-danger"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
        start(async () => {
          const res = await showDeleteAction(id);
          if (!res.ok) {
            window.alert(`Delete failed: ${res.error}`);
            return;
          }
          router.refresh();
        });
      }}
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}
