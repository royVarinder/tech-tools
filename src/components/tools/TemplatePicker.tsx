"use client";

import { useEffect, useState } from "react";
import { getResumeTemplateStyle } from "@/lib/resumeTemplateStyles";

interface TemplateItem {
  id: string;
  name: string;
  layoutKey: string;
  thumbnailUrl: string | null;
  description: string | null;
}

export default function TemplatePicker({
  toolSlug,
  onSelect,
}: {
  toolSlug: string;
  onSelect: (layoutKey: string) => void;
}) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/templates?toolSlug=${encodeURIComponent(toolSlug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toolSlug]);

  if (loading) {
    return <p className="text-sm text-muted">Loading templates...</p>;
  }

  if (templates.length === 0) {
    return <p className="text-sm text-muted">No templates are available right now.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => {
        const style = getResumeTemplateStyle(template.layoutKey);
        return (
          <div key={template.id} className="brand-card overflow-hidden">
            <div className="flex h-28 items-center justify-center" style={{ backgroundColor: style.accentColorCss }}>
              {style.columns === 2 ? (
                <div className="flex h-full w-full">
                  <div className="h-full w-2/5" style={{ backgroundColor: style.accentColorCss, filter: "brightness(0.85)" }} />
                  <div className="h-full flex-1 bg-white" />
                </div>
              ) : (
                <span className="font-heading text-lg font-bold text-white">{template.name}</span>
              )}
            </div>
            <div className="p-4">
              <p className="font-heading text-sm font-semibold text-foreground">{template.name}</p>
              {template.description && <p className="mt-1 text-xs text-muted">{template.description}</p>}
              <button
                type="button"
                onClick={() => onSelect(template.layoutKey)}
                className="brand-pill-btn mt-3 w-full py-2 text-xs"
              >
                Use this template
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
