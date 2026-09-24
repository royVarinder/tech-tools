"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function ProApplyForm() {
  const t = useTranslations("pro");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/pro/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || t("genericError"));
        setSubmitting(false);
        return;
      }

      router.refresh();
    } catch {
      setError(t("genericError"));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">{t("reasonLabel")}</label>
        <textarea
          required
          minLength={10}
          maxLength={1000}
          rows={5}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("reasonPlaceholder")}
          className="brand-input w-full px-4 py-3 text-sm"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="brand-pill-btn w-full py-3 text-sm disabled:opacity-70"
      >
        {submitting ? t("submitting") : t("submitButton")}
      </button>
    </form>
  );
}
