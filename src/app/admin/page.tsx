import Link from "next/link";
import { requireAdminPage } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import { getVisitorStats } from "@/lib/visitorStats";
import AdminShell from "@/components/admin/AdminShell";
import VisitorsChart from "@/components/admin/VisitorsChart";

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();

  await connectToDatabase();
  const stats = await getVisitorStats();

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">Dashboard</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile label="Total visitors" value={stats.totalVisitors.toLocaleString("en-IN")} />
        <StatTile label="Total visits" value={stats.totalVisits.toLocaleString("en-IN")} />
      </div>

      <div className="brand-card mt-4 p-5">
        <h2 className="font-heading text-sm font-semibold text-foreground">Visits over the last 30 days</h2>
        <div className="mt-3">
          <VisitorsChart daily={stats.daily} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminNavCard href="/admin/users" title="Users" description="View, edit, and remove registered users." />
        <AdminNavCard href="/admin/visitors" title="Visitors" description="Search visitor traffic tracked by IP." />
        <AdminNavCard href="/admin/portal-links" title="Portal Links" description="Manage homepage service/portal cards." />
        <AdminNavCard href="/admin/faqs" title="FAQs" description="Manage the homepage FAQ list." />
      </div>
    </AdminShell>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="brand-card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-heading text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function AdminNavCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="brand-card block p-5 transition hover:-translate-y-1">
      <h2 className="font-heading text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </Link>
  );
}
