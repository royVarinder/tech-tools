"use client";

import { useState } from "react";

interface PortalLink {
  id: string;
  slug: string;
  categorySlug: string;
  title: string;
  href: string | null;
  externalUrl: string | null;
  active: boolean;
}

interface CategoryOption {
  slug: string;
  title: string;
}

const EMPTY_FORM = { slug: "", categorySlug: "", title: "", externalUrl: "" };

export default function PortalLinksManager({
  initialServices,
  categoryOptions,
}: {
  initialServices: PortalLink[];
  categoryOptions: CategoryOption[];
}) {
  const [services, setServices] = useState(initialServices);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/admin/portal-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: form.slug,
        categorySlug: form.categorySlug,
        title: form.title,
        externalUrl: form.externalUrl || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create portal link.");
      return;
    }

    setServices((prev) => [
      ...prev,
      {
        id: data.id,
        slug: form.slug,
        categorySlug: form.categorySlug,
        title: form.title,
        href: null,
        externalUrl: form.externalUrl || null,
        active: true,
      },
    ]);
    setForm(EMPTY_FORM);
  }

  async function saveUrl(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/portal-links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalUrl: editUrl || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to update.");
      return;
    }
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, externalUrl: editUrl || null } : s)));
    setEditingId(null);
  }

  async function toggleActive(service: PortalLink) {
    const res = await fetch(`/api/admin/portal-links/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !service.active }),
    });
    if (!res.ok) return;
    setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, active: !s.active } : s)));
  }

  async function deleteService(id: string) {
    if (!confirm("Delete this portal link?")) return;
    const res = await fetch(`/api/admin/portal-links/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="mt-6">
      <form onSubmit={handleCreate} className="brand-card mb-6 flex flex-wrap gap-2 p-4">
        <input
          required
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          placeholder="slug (unique)"
          className="brand-input px-3 py-2 text-sm"
        />
        <select
          required
          value={form.categorySlug}
          onChange={(e) => setForm((f) => ({ ...f, categorySlug: e.target.value }))}
          className="brand-input px-3 py-2 text-sm"
        >
          <option value="">Category...</option>
          {categoryOptions.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.title}
            </option>
          ))}
        </select>
        <input
          required
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Title"
          className="brand-input px-3 py-2 text-sm"
        />
        <input
          value={form.externalUrl}
          onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))}
          placeholder="https://... (optional)"
          className="brand-input min-w-[240px] flex-1 px-3 py-2 text-sm"
        />
        <button type="submit" className="brand-pill-btn px-4 py-2 text-sm">
          Add
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">External URL</th>
              <th className="py-2 pr-4">Active</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} className="border-b border-border">
                <td className="py-2 pr-4">{service.title}</td>
                <td className="py-2 pr-4">{service.categorySlug}</td>
                <td className="py-2 pr-4">
                  {editingId === service.id ? (
                    <input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      className="brand-input px-2 py-1 text-sm"
                    />
                  ) : (
                    service.externalUrl || service.href || "—"
                  )}
                </td>
                <td className="py-2 pr-4">{service.active ? "Yes" : "No"}</td>
                <td className="py-2 pr-4">
                  <div className="flex gap-3">
                    {editingId === service.id ? (
                      <>
                        <button onClick={() => saveUrl(service.id)} className="text-brand-bright hover:underline">
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-muted hover:underline">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(service.id);
                          setEditUrl(service.externalUrl ?? "");
                        }}
                        className="text-brand-bright hover:underline"
                      >
                        Edit URL
                      </button>
                    )}
                    <button onClick={() => toggleActive(service)} className="text-muted hover:underline">
                      {service.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => deleteService(service.id)} className="text-danger hover:underline">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted">
                  No portal links yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
