"use client";

import { useState } from "react";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { useTranslations } from "next-intl";
import { FcEmptyTrash } from "react-icons/fc";
import { downloadBlob, bytesToBlob } from "@/lib/download";

interface ExperienceEntry {
  company: string;
  role: string;
  period: string;
  description: string;
}

interface EducationEntry {
  school: string;
  degree: string;
  period: string;
}

const emptyExperience: ExperienceEntry = { company: "", role: "", period: "", description: "" };
const emptyEducation: EducationEntry = { school: "", degree: "", period: "" };

export default function ResumeMaker() {
  const t = useTranslations("common");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState<ExperienceEntry[]>([{ ...emptyExperience }]);
  const [education, setEducation] = useState<EducationEntry[]>([{ ...emptyEducation }]);
  const [busy, setBusy] = useState(false);

  const skillList = skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  function updateExperience(index: number, patch: Partial<ExperienceEntry>) {
    setExperience((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateEducation(index: number, patch: Partial<EducationEntry>) {
    setEducation((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function generatePdf() {
    setBusy(true);
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const margin = 50;
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;

      function ensureSpace(lineHeight: number) {
        if (y - lineHeight < margin) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
      }

      function drawWrapped(text: string, options: { size: number; font: PDFFont; color?: ReturnType<typeof rgb>; gap?: number }) {
        const { size, font: usedFont, color = rgb(0.15, 0.15, 0.18), gap = size * 1.4 } = options;
        const maxWidth = pageWidth - margin * 2;
        const words = text.split(/\s+/).filter(Boolean);
        let line = "";

        for (const word of words) {
          const testLine = line ? `${line} ${word}` : word;
          const width = usedFont.widthOfTextAtSize(testLine, size);
          if (width > maxWidth && line) {
            ensureSpace(gap);
            page.drawText(line, { x: margin, y, size, font: usedFont, color });
            y -= gap;
            line = word;
          } else {
            line = testLine;
          }
        }
        if (line) {
          ensureSpace(gap);
          page.drawText(line, { x: margin, y, size, font: usedFont, color });
          y -= gap;
        }
      }

      function drawHeading(text: string) {
        ensureSpace(26);
        y -= 6;
        page.drawText(text.toUpperCase(), { x: margin, y, size: 12, font: boldFont, color: rgb(0.29, 0.24, 0.85) });
        y -= 4;
        page.drawLine({
          start: { x: margin, y },
          end: { x: pageWidth - margin, y },
          thickness: 1,
          color: rgb(0.85, 0.85, 0.9),
        });
        y -= 14;
      }

      // Header
      page.drawText(name || "Your Name", { x: margin, y, size: 22, font: boldFont, color: rgb(0.1, 0.1, 0.15) });
      y -= 26;
      if (title) {
        page.drawText(title, { x: margin, y, size: 13, font, color: rgb(0.29, 0.24, 0.85) });
        y -= 20;
      }
      const contactLine = [email, phone, location].filter(Boolean).join("   •   ");
      if (contactLine) {
        page.drawText(contactLine, { x: margin, y, size: 10, font, color: rgb(0.4, 0.4, 0.45) });
        y -= 20;
      }

      if (summary) {
        drawHeading("Summary");
        drawWrapped(summary, { size: 10.5, font });
        y -= 6;
      }

      const experienceEntries = experience.filter((e) => e.company || e.role);
      if (experienceEntries.length > 0) {
        drawHeading("Experience");
        for (const exp of experienceEntries) {
          ensureSpace(16);
          page.drawText(`${exp.role || "Role"} — ${exp.company || "Company"}`, {
            x: margin,
            y,
            size: 11,
            font: boldFont,
          });
          if (exp.period) {
            const periodWidth = font.widthOfTextAtSize(exp.period, 9.5);
            page.drawText(exp.period, {
              x: pageWidth - margin - periodWidth,
              y,
              size: 9.5,
              font,
              color: rgb(0.45, 0.45, 0.5),
            });
          }
          y -= 16;
          if (exp.description) {
            drawWrapped(exp.description, { size: 10, font, color: rgb(0.3, 0.3, 0.35) });
          }
          y -= 6;
        }
      }

      const educationEntries = education.filter((e) => e.school || e.degree);
      if (educationEntries.length > 0) {
        drawHeading("Education");
        for (const edu of educationEntries) {
          ensureSpace(16);
          page.drawText(`${edu.degree || "Degree"} — ${edu.school || "School"}`, {
            x: margin,
            y,
            size: 11,
            font: boldFont,
          });
          if (edu.period) {
            const periodWidth = font.widthOfTextAtSize(edu.period, 9.5);
            page.drawText(edu.period, {
              x: pageWidth - margin - periodWidth,
              y,
              size: 9.5,
              font,
              color: rgb(0.45, 0.45, 0.5),
            });
          }
          y -= 20;
        }
      }

      if (skillList.length > 0) {
        drawHeading("Skills");
        drawWrapped(skillList.join("   •   "), { size: 10.5, font });
      }

      const pdfBytes = await pdfDoc.save();
      downloadBlob(bytesToBlob(pdfBytes, "application/pdf"), `${name || "resume"}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <Section title="Personal details">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Full name" value={name} onChange={setName} />
            <Input label="Job title" value={title} onChange={setTitle} />
            <Input label="Email" value={email} onChange={setEmail} />
            <Input label="Phone" value={phone} onChange={setPhone} />
            <Input label="Location" value={location} onChange={setLocation} className="sm:col-span-2" />
          </div>
          <Textarea label="Professional summary" value={summary} onChange={setSummary} rows={3} />
        </Section>

        <Section title="Experience">
          {experience.map((exp, i) => (
            <div key={i} className="mb-4 space-y-2 rounded-lg border border-border p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input label="Company" value={exp.company} onChange={(v) => updateExperience(i, { company: v })} />
                <Input label="Role" value={exp.role} onChange={(v) => updateExperience(i, { role: v })} />
                <Input
                  label="Period (e.g. 2021 - Present)"
                  value={exp.period}
                  onChange={(v) => updateExperience(i, { period: v })}
                  className="sm:col-span-2"
                />
              </div>
              <Textarea label="Description" value={exp.description} onChange={(v) => updateExperience(i, { description: v })} rows={2} />
              {experience.length > 1 && (
                <button
                  type="button"
                  onClick={() => setExperience((prev) => prev.filter((_, idx) => idx !== i))}
                  className="inline-flex items-center gap-1 text-xs font-medium text-danger transition-transform hover:scale-105 hover:underline"
                >
                  <FcEmptyTrash className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExperience((prev) => [...prev, { ...emptyExperience }])}
            className="text-sm font-medium text-brand-bright hover:underline"
          >
            + Add experience
          </button>
        </Section>

        <Section title="Education">
          {education.map((edu, i) => (
            <div key={i} className="mb-4 space-y-2 rounded-lg border border-border p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input label="School" value={edu.school} onChange={(v) => updateEducation(i, { school: v })} />
                <Input label="Degree" value={edu.degree} onChange={(v) => updateEducation(i, { degree: v })} />
                <Input
                  label="Period"
                  value={edu.period}
                  onChange={(v) => updateEducation(i, { period: v })}
                  className="sm:col-span-2"
                />
              </div>
              {education.length > 1 && (
                <button
                  type="button"
                  onClick={() => setEducation((prev) => prev.filter((_, idx) => idx !== i))}
                  className="inline-flex items-center gap-1 text-xs font-medium text-danger transition-transform hover:scale-105 hover:underline"
                >
                  <FcEmptyTrash className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setEducation((prev) => [...prev, { ...emptyEducation }])}
            className="text-sm font-medium text-brand-bright hover:underline"
          >
            + Add education
          </button>
        </Section>

        <Section title="Skills">
          <Input label="Comma-separated skills" value={skills} onChange={setSkills} placeholder="React, Node.js, Figma" />
        </Section>

        <button
          type="button"
          disabled={busy}
          onClick={generatePdf}
          className="w-full rounded-xl brand-pill-btn py-3 transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
        >
          {busy ? t("processing") : t("download") + " Resume PDF"}
        </button>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted">
          A4 preview
        </p>
        <div className="aspect-[210/297] w-full overflow-y-auto rounded-lg bg-white p-8 text-slate-900 shadow-2xl ring-1 ring-black/10 sm:p-10">
          <h2 className="text-2xl font-bold text-slate-900">{name || "Your Name"}</h2>
          {title && <p className="font-medium text-emerald-600">{title}</p>}
          <p className="mt-1 text-xs text-slate-500">
            {[email, phone, location].filter(Boolean).join("  •  ")}
          </p>

          {summary && (
            <PreviewSection heading="Summary">
              <p className="text-sm text-slate-600">{summary}</p>
            </PreviewSection>
          )}

          {experience.some((e) => e.company || e.role) && (
            <PreviewSection heading="Experience">
              {experience
                .filter((e) => e.company || e.role)
                .map((exp, i) => (
                  <div key={i} className="mb-3">
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-semibold text-slate-800">
                        {exp.role || "Role"} — {exp.company || "Company"}
                      </p>
                      <span className="text-xs text-slate-400">{exp.period}</span>
                    </div>
                    {exp.description && <p className="text-sm text-slate-600">{exp.description}</p>}
                  </div>
                ))}
            </PreviewSection>
          )}

          {education.some((e) => e.school || e.degree) && (
            <PreviewSection heading="Education">
              {education
                .filter((e) => e.school || e.degree)
                .map((edu, i) => (
                  <div key={i} className="mb-2 flex items-baseline justify-between">
                    <p className="text-sm font-semibold text-slate-800">
                      {edu.degree || "Degree"} — {edu.school || "School"}
                    </p>
                    <span className="text-xs text-slate-400">{edu.period}</span>
                  </div>
                ))}
            </PreviewSection>
          )}

          {skillList.length > 0 && (
            <PreviewSection heading="Skills">
              <div className="flex flex-wrap gap-2">
                {skillList.map((skill, i) => (
                  <span key={i} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    {skill}
                  </span>
                ))}
              </div>
            </PreviewSection>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}

function PreviewSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-600">{heading}</h3>
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  className,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-light focus:outline-none"
      />
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="mt-3">
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-light focus:outline-none"
      />
    </div>
  );
}
