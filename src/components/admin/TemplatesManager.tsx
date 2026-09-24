"use client";

import { useState } from "react";

interface AdminTemplate {
  id: string;
  toolSlug: string;
  name: string;
  layoutKey: string;
  thumbnailUrl: string | null;
  description: string | null;
  order: number;
  active: boolean;
}

const EMPTY_FORM = { toolSlug: "pro-resume-maker", name: "", layoutKey: "", description: "" };

export default function TemplatesManager({ initialTemplates }: { initialTemplates: AdminTemplate[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/admin/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create template.");
      return;
    }

    setTemplates((prev) => [
      ...prev,
      {
        id: data.id,
        toolSlug: form.toolSlug,
        name: form.name,
        layoutKey: form.layoutKey,
        thumbnailUrl: null,
        description: form.description || null,
        order: prev.filter((t) => t.toolSlug === form.toolSlug).length,
        active: true,
      },
    ]);
    setForm(EMPTY_FORM);
  }

  async function toggleActive(template: AdminTemplate) {
    const res = await fetch(`/api/admin/templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !template.active }),
    });
    if (!res.ok) return;
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, active: !t.active } : t))
    );
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="mt-6">
      <form onSubmit={handleCreate} className="brand-card mb-6 flex flex-wrap gap-2 p-4">
        <input
          required
          value={form.toolSlug}
          onChange={(e) => setForm((f) => ({ ...f, toolSlug: e.target.value }))}
          placeholder="toolSlug (e.g. pro-resume-maker)"
          className="brand-input px-3 py-2 text-sm"
        />
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Name"
          className="brand-input px-3 py-2 text-sm"
        />
        <input
          required
          value={form.layoutKey}
          onChange={(e) => setForm((f) => ({ ...f, layoutKey: e.target.value }))}
          placeholder="layoutKey (e.g. classic)"
          className="brand-input px-3 py-2 text-sm"
        />
        <input
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Description (optional)"
          className="brand-input min-w-[220px] flex-1 px-3 py-2 text-sm"
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
              <th className="py-2 pr-4">Tool</th>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Layout key</th>
              <th className="py-2 pr-4">Active</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id} className="border-b border-border">
                <td className="py-2 pr-4">{template.toolSlug}</td>
                <td className="py-2 pr-4">{template.name}</td>
                <td className="py-2 pr-4">{template.layoutKey}</td>
                <td className="py-2 pr-4">{template.active ? "Yes" : "No"}</td>
                <td className="py-2 pr-4">
                  <div className="flex gap-3">
                    <button onClick={() => toggleActive(template)} className="text-brand-bright hover:underline">
                      {template.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => deleteTemplate(template.id)} className="text-danger hover:underline">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted">
                  No templates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
