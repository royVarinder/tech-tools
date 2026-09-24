import Link from "next/link";
import { requireAdminPage } from "@/lib/requireAdmin";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">Dashboard</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminNavCard href="/admin/users" title="Users" description="View, edit, and remove registered users." />
        <AdminNavCard href="/admin/visitors" title="Visitors" description="Search visitor traffic tracked by IP." />
        <AdminNavCard href="/admin/portal-links" title="Portal Links" description="Manage homepage service/portal cards." />
        <AdminNavCard href="/admin/faqs" title="FAQs" description="Manage the homepage FAQ list." />
      </div>
    </AdminShell>
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
