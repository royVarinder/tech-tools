"use client";

import { useState } from "react";

interface VisitorAction {
  path: string;
  locale?: string;
  userId?: string;
  email?: string;
  userAgent?: string;
  referer?: string;
  at: string;
}

interface AdminVisitor {
  id: string;
  ip: string;
  visitCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  actions: VisitorAction[];
}

export default function VisitorsBrowser({ initialVisitors }: { initialVisitors: AdminVisitor[] }) {
  const [visitors, setVisitors] = useState(initialVisitors);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function runSearch(q: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/visitors?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setVisitors(data);
    setLoading(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  return (
    <div className="mt-6">
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by IP or path..."
          className="brand-input flex-1 px-4 py-2 text-sm"
        />
        <button type="submit" className="brand-pill-btn px-4 py-2 text-sm">
          {loading ? "..." : "Search"}
        </button>
      </form>

      <div className="space-y-2">
        {visitors.map((visitor) => (
          <div key={visitor.id} className="brand-card p-4">
            <button
              type="button"
              onClick={() => setExpandedId((id) => (id === visitor.id ? null : visitor.id))}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <p className="font-medium text-foreground">{visitor.ip}</p>
                <p className="text-xs text-muted">
                  {visitor.visitCount} visits · last seen {new Date(visitor.lastSeenAt).toLocaleString()}
                </p>
              </div>
              <span className="text-xs text-muted">{expandedId === visitor.id ? "Hide" : "View"} actions</span>
            </button>

            {expandedId === visitor.id && (
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted">
                {visitor.actions.map((action, i) => (
                  <li key={i}>
                    <span className="text-foreground">{action.path}</span>{" "}
                    {action.email && <span>· {action.email}</span>} <span>· {new Date(action.at).toLocaleString()}</span>
                  </li>
                ))}
                {visitor.actions.length === 0 && <li>No recorded actions.</li>}
              </ul>
            )}
          </div>
        ))}
        {visitors.length === 0 && <p className="text-sm text-muted">No visitors found.</p>}
      </div>
    </div>
  );
}
