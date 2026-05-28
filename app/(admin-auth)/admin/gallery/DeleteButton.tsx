"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { galleryDeleteAction } from "@/app/actions/gallery";

export default function DeleteButton({
  id,
  title,
}: {
  id: number;
  title: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      className="btn btn-danger"
      disabled={pending}
      onClick={() => {
        const typed = window.prompt(
          `Type the exact title to delete:\n${title}`,
          "",
        );
        if (typed !== title) return;
        start(async () => {
          const res = await galleryDeleteAction(id);
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
