"use client";

import { useState } from "react";

interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  active: boolean;
}

const EMPTY_FORM = { question: "", answer: "" };

export default function FaqsManager({ initialFaqs }: { initialFaqs: AdminFaq[] }) {
  const [faqs, setFaqs] = useState(initialFaqs);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(EMPTY_FORM);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/admin/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create FAQ.");
      return;
    }

    setFaqs((prev) => [...prev, { id: data.id, question: form.question, answer: form.answer, active: true }]);
    setForm(EMPTY_FORM);
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/admin/faqs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editDraft),
    });
    if (!res.ok) {
      setError("Failed to update FAQ.");
      return;
    }
    setFaqs((prev) =>
      prev.map((f) => (f.id === id ? { ...f, question: editDraft.question, answer: editDraft.answer } : f))
    );
    setEditingId(null);
  }

  async function toggleActive(faq: AdminFaq) {
    const res = await fetch(`/api/admin/faqs/${faq.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !faq.active }),
    });
    if (!res.ok) return;
    setFaqs((prev) => prev.map((f) => (f.id === faq.id ? { ...f, active: !f.active } : f)));
  }

  async function deleteFaq(id: string) {
    if (!confirm("Delete this FAQ?")) return;
    const res = await fetch(`/api/admin/faqs/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setFaqs((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="mt-6">
      <form onSubmit={handleCreate} className="brand-card mb-6 space-y-2 p-4">
        <input
          required
          value={form.question}
          onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
          placeholder="Question"
          className="brand-input w-full px-3 py-2 text-sm"
        />
        <textarea
          required
          value={form.answer}
          onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
          placeholder="Answer"
          rows={3}
          className="brand-input w-full px-3 py-2 text-sm"
        />
        <button type="submit" className="brand-pill-btn px-4 py-2 text-sm">
          Add FAQ
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="space-y-3">
        {faqs.map((faq) => (
          <div key={faq.id} className="brand-card p-4">
            {editingId === faq.id ? (
              <div className="space-y-2">
                <input
                  value={editDraft.question}
                  onChange={(e) => setEditDraft((d) => ({ ...d, question: e.target.value }))}
                  className="brand-input w-full px-3 py-2 text-sm"
                />
                <textarea
                  value={editDraft.answer}
                  onChange={(e) => setEditDraft((d) => ({ ...d, answer: e.target.value }))}
                  rows={3}
                  className="brand-input w-full px-3 py-2 text-sm"
                />
                <div className="flex gap-3">
                  <button onClick={() => saveEdit(faq.id)} className="text-brand-bright hover:underline">
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-muted hover:underline">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="font-medium text-foreground">{faq.question}</p>
                <p className="mt-1 text-sm text-muted">{faq.answer}</p>
                <div className="mt-3 flex gap-3 text-sm">
                  <button
                    onClick={() => {
                      setEditingId(faq.id);
                      setEditDraft({ question: faq.question, answer: faq.answer });
                    }}
                    className="text-brand-bright hover:underline"
                  >
                    Edit
                  </button>
                  <button onClick={() => toggleActive(faq)} className="text-muted hover:underline">
                    {faq.active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => deleteFaq(faq.id)} className="text-danger hover:underline">
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {faqs.length === 0 && <p className="text-sm text-muted">No FAQs yet.</p>}
      </div>
    </div>
  );
}
