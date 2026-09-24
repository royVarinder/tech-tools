import { requireAdminPage } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import AdminShell from "@/components/admin/AdminShell";
import UsersTable from "@/components/admin/UsersTable";

export default async function AdminUsersPage() {
  const session = await requireAdminPage();

  await connectToDatabase();
  const users = await User.find().sort({ createdAt: -1 }).lean();

  const initialUsers = users.map((user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    recentToolsCount: user.recentTools?.length ?? 0,
  }));

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">Users</h1>
      <p className="mt-1 text-sm text-muted">{initialUsers.length} registered users.</p>
      <UsersTable initialUsers={initialUsers} />
    </AdminShell>
  );
}
