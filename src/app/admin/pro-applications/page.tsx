import { requireAdminPage } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import ProApplication from "@/models/ProApplication";
import AdminShell from "@/components/admin/AdminShell";
import ProApplicationsTable from "@/components/admin/ProApplicationsTable";

export default async function AdminProApplicationsPage() {
  const session = await requireAdminPage();

  await connectToDatabase();
  const applications = await ProApplication.find().sort({ createdAt: -1 }).lean();

  const initialApplications = applications.map((a) => ({
    id: a._id.toString(),
    name: a.name,
    email: a.email,
    reason: a.reason,
    status: a.status,
    decidedBy: a.decidedBy,
    decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">Pro Applications</h1>
      <p className="mt-1 text-sm text-muted">
        {initialApplications.filter((a) => a.status === "pending").length} pending.
      </p>
      <ProApplicationsTable initialApplications={initialApplications} />
    </AdminShell>
  );
}
