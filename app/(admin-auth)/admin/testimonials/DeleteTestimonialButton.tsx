"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { testimonialDeleteAction } from "@/app/actions/testimonials";

export default function DeleteTestimonialButton({
  id,
  attribution,
}: {
  id: number;
  attribution: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-danger"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete review by ${attribution}?`)) return;
        start(async () => {
          const res = await testimonialDeleteAction(id);
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
