import { requireAdminPage } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Service from "@/models/Service";
import Category from "@/models/Category";
import AdminShell from "@/components/admin/AdminShell";
import PortalLinksManager from "@/components/admin/PortalLinksManager";

export default async function AdminPortalLinksPage() {
  const session = await requireAdminPage();

  await connectToDatabase();
  const [services, categories] = await Promise.all([
    Service.find().sort({ categorySlug: 1, order: 1 }).lean(),
    Category.find().sort({ order: 1 }).lean(),
  ]);

  const initialServices = services.map((s) => ({
    id: s._id.toString(),
    slug: s.slug,
    categorySlug: s.categorySlug,
    title: s.title,
    href: s.href,
    externalUrl: s.externalUrl ?? null,
    active: s.active,
  }));

  const categoryOptions = categories.map((c) => ({ slug: c.slug, title: c.title }));

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">Portal Links</h1>
      <p className="mt-1 text-sm text-muted">
        Manage the homepage service cards. Set an external URL to make a &quot;Coming soon&quot; card a real link.
      </p>
      <PortalLinksManager initialServices={initialServices} categoryOptions={categoryOptions} />
    </AdminShell>
  );
}
