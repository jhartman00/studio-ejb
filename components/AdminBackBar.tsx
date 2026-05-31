import Link from "next/link";

export default function AdminBackBar({
  href = "/admin",
  label,
}: {
  href?: string;
  label?: string;
}) {
  return (
    <div className="admin-back-bar">
      <Link href={href} className="admin-back-link">
        <span aria-hidden="true">←</span> {label ?? "Back"}
      </Link>
    </div>
  );
}
