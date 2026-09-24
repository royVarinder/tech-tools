import { requireAdminPage } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Template from "@/models/Template";
import AdminShell from "@/components/admin/AdminShell";
import TemplatesManager from "@/components/admin/TemplatesManager";

export default async function AdminTemplatesPage() {
  const session = await requireAdminPage();

  await connectToDatabase();
  const templates = await Template.find().sort({ toolSlug: 1, order: 1 }).lean();

  const initialTemplates = templates.map((t) => ({
    id: t._id.toString(),
    toolSlug: t.toolSlug,
    name: t.name,
    layoutKey: t.layoutKey,
    thumbnailUrl: t.thumbnailUrl,
    description: t.description,
    order: t.order,
    active: t.active,
  }));

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">Templates</h1>
      <p className="mt-1 text-sm text-muted">
        Manage the template catalog offered inside creative tools (e.g. Pro Resume Maker).
      </p>
      <TemplatesManager initialTemplates={initialTemplates} />
    </AdminShell>
  );
}
