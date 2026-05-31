import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getPageSections, getGalleryItems } from "@/lib/db/queries";
import AdminBackBar from "@/components/AdminBackBar";
import PageEditor from "./PageEditor";

const ALLOWED_PAGES = new Set([
  "home",
  "about",
  "contact",
  "gallery",
  "shows",
]);

export const dynamic = "force-dynamic";

export default async function AdminPageEditor({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!ALLOWED_PAGES.has(slug)) notFound();

  const adm = await requireAdmin();
  if (!adm.ok) redirect("/admin/login");

  const [sections, galleryItems] = await Promise.all([
    getPageSections(slug),
    slug === "home" ? getGalleryItems() : Promise.resolve([]),
  ]);

  return (
    <>
      <AdminBackBar href="/admin" label="Back to dashboard" />
      <PageEditor
        pageSlug={slug}
        sections={sections.map((s) => ({
          page: s.page,
          section: s.section,
          data: s.data,
          enabled: s.enabled,
          sort_order: s.sort_order,
        }))}
        galleryItems={galleryItems.map((g) => ({
          // pg returns bigserial as a string; coerce to number for the editor.
          id: Number(g.id),
          title: g.title,
          slug: g.slug,
        }))}
      />
    </>
  );
}
