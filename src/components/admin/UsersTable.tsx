"use client";

import { useState } from "react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  recentToolsCount: number;
}

export default function UsersTable({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function startEdit(user: AdminUser) {
    setEditingId(user.id);
    setDraftName(user.name);
    setDraftEmail(user.email);
    setError(null);
  }

  async function saveEdit(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draftName, email: draftEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to update user.");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, name: data.name, email: data.email } : u)));
    setEditingId(null);
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete user.");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="mt-6 overflow-x-auto">
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Recent tools</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-border">
              <td className="py-2 pr-4">
                {editingId === user.id ? (
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="brand-input px-2 py-1 text-sm"
                  />
                ) : (
                  user.name
                )}
              </td>
              <td className="py-2 pr-4">
                {editingId === user.id ? (
                  <input
                    value={draftEmail}
                    onChange={(e) => setDraftEmail(e.target.value)}
                    className="brand-input px-2 py-1 text-sm"
                  />
                ) : (
                  user.email
                )}
              </td>
              <td className="py-2 pr-4">{user.recentToolsCount}</td>
              <td className="py-2 pr-4">
                {editingId === user.id ? (
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(user.id)} className="text-brand-bright hover:underline">
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-muted hover:underline">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(user)} className="text-brand-bright hover:underline">
                      Edit
                    </button>
                    <button onClick={() => deleteUser(user.id)} className="text-danger hover:underline">
                      Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-muted">
                No users yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
