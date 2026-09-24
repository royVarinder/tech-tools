"use client";

import { useState } from "react";

interface ProApplicationRow {
  id: string;
  name: string;
  email: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export default function ProApplicationsTable({
  initialApplications,
}: {
  initialApplications: ProApplicationRow[];
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, action: "approve" | "reject") {
    setError(null);
    const res = await fetch(`/api/admin/pro-applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to update application.");
      return;
    }
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: data.status } : a))
    );
  }

  return (
    <div className="mt-6 overflow-x-auto">
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <table className="w-full min-w-[700px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Reason</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.id} className="border-b border-border align-top">
              <td className="py-2 pr-4">{application.name}</td>
              <td className="py-2 pr-4">{application.email}</td>
              <td className="max-w-xs py-2 pr-4 whitespace-pre-wrap text-muted">{application.reason}</td>
              <td className="py-2 pr-4 capitalize">{application.status}</td>
              <td className="py-2 pr-4">
                {application.status === "pending" ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => decide(application.id, "approve")}
                      className="text-brand-bright hover:underline"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide(application.id, "reject")}
                      className="text-danger hover:underline"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted">by {application.decidedBy}</span>
                )}
              </td>
            </tr>
          ))}
          {applications.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-muted">
                No applications yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
