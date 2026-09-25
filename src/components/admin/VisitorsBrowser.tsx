"use client";

import { Fragment, useCallback, useState } from "react";
import { formatIST } from "@/lib/formatDate";

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

export default function VisitorsBrowser({
  initialVisitors,
  initialTotal,
  pageSize,
}: {
  initialVisitors: AdminVisitor[];
  initialTotal: number;
  pageSize: number;
}) {
  const [visitors, setVisitors] = useState(initialVisitors);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const runSearch = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (ipFilter) params.set("ip", ipFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      params.set("page", String(targetPage));
      params.set("limit", String(pageSize));

      const res = await fetch(`/api/admin/visitors?${params.toString()}`);
      const data = await res.json();
      setVisitors(data.visitors);
      setTotal(data.total);
      setPage(data.page);
      setLoading(false);
    },
    [query, ipFilter, fromDate, toDate, pageSize]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(1);
  }

  function handleReset() {
    setQuery("");
    setIpFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
    setLoading(true);
    fetch(`/api/admin/visitors?page=1&limit=${pageSize}`)
      .then((res) => res.json())
      .then((data) => {
        setVisitors(data.visitors);
        setTotal(data.total);
        setPage(data.page);
      })
      .finally(() => setLoading(false));
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mt-6">
      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-45 flex-1">
          <label className="mb-1 block text-xs font-medium text-muted">Search (IP or path)</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by IP or path..."
            className="brand-input w-full px-4 py-2 text-sm"
          />
        </div>
        <div className="min-w-35">
          <label className="mb-1 block text-xs font-medium text-muted">Filter by IP</label>
          <input
            value={ipFilter}
            onChange={(e) => setIpFilter(e.target.value)}
            placeholder="e.g. 192.168"
            className="brand-input w-full px-4 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">From (IST)</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="brand-input px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">To (IST)</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="brand-input px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="brand-pill-btn cursor-pointer px-4 py-2 text-sm">
          {loading ? "..." : "Apply"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-soft"
        >
          Reset
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-190 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-4">IP</th>
              <th className="py-2 pr-4">Visits</th>
              <th className="py-2 pr-4">First seen (IST)</th>
              <th className="py-2 pr-4">Last seen (IST)</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visitors.map((visitor) => (
              <Fragment key={visitor.id}>
                <tr
                  onClick={() => setExpandedId((id) => (id === visitor.id ? null : visitor.id))}
                  className="cursor-pointer border-b border-border transition-colors hover:bg-surface-soft"
                >
                  <td className="py-2 pr-4 font-medium text-foreground">{visitor.ip}</td>
                  <td className="py-2 pr-4">{visitor.visitCount}</td>
                  <td className="py-2 pr-4 text-muted">{formatIST(visitor.firstSeenAt)}</td>
                  <td className="py-2 pr-4 text-muted">{formatIST(visitor.lastSeenAt)}</td>
                  <td className="py-2 pr-4 text-brand-bright">
                    {expandedId === visitor.id ? "Hide" : "View"} ({visitor.actions.length})
                  </td>
                </tr>
                {expandedId === visitor.id && (
                  <tr key={`${visitor.id}-detail`} className="border-b border-border bg-surface-soft">
                    <td colSpan={5} className="px-4 py-3">
                      <ul className="space-y-1 text-xs text-muted">
                        {visitor.actions.map((action, i) => (
                          <li key={i}>
                            <span className="text-foreground">{action.path}</span>{" "}
                            {action.email && <span>· {action.email}</span>} <span>· {formatIST(action.at)}</span>
                          </li>
                        ))}
                        {visitor.actions.length === 0 && <li>No recorded actions.</li>}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {visitors.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted">
                  No visitors found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => runSearch(page - 1)}
              className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => runSearch(page + 1)}
              className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
