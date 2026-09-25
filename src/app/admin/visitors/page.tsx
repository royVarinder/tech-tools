import { requireAdminPage } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Visitor, { type VisitorAction } from "@/models/Visitor";
import AdminShell from "@/components/admin/AdminShell";
import VisitorsBrowser from "@/components/admin/VisitorsBrowser";

const PAGE_SIZE = 20;

export default async function AdminVisitorsPage() {
  const session = await requireAdminPage();

  await connectToDatabase();
  const [visitors, total] = await Promise.all([
    Visitor.find().sort({ lastSeenAt: -1 }).limit(PAGE_SIZE).lean(),
    Visitor.countDocuments(),
  ]);

  const initialVisitors = visitors.map((visitor) => ({
    id: visitor._id.toString(),
    ip: visitor.ip,
    visitCount: visitor.visitCount,
    firstSeenAt: visitor.firstSeenAt.toISOString(),
    lastSeenAt: visitor.lastSeenAt.toISOString(),
    actions: visitor.actions
      .slice(-20)
      .reverse()
      .map((a: VisitorAction) => ({ ...a, at: a.at.toISOString() })),
  }));

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">Visitors</h1>
      <p className="mt-1 text-sm text-muted">{total} tracked IPs.</p>
      <VisitorsBrowser initialVisitors={initialVisitors} initialTotal={total} pageSize={PAGE_SIZE} />
    </AdminShell>
  );
}
