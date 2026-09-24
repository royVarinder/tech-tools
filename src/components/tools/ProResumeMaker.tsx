"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { FcEmptyTrash } from "react-icons/fc";
import { downloadBlob, bytesToBlob } from "@/lib/download";
import { generateResumePdf, type ResumeExperienceEntry, type ResumeEducationEntry } from "@/lib/generateResumePdf";
import Modal from "@/components/Modal";
import TemplatePicker from "@/components/tools/TemplatePicker";

const emptyExperience: ResumeExperienceEntry = { company: "", role: "", period: "", description: "" };
const emptyEducation: ResumeEducationEntry = { school: "", degree: "", period: "" };

export default function ProResumeMaker({ isPro, isLoggedIn }: { isPro: boolean; isLoggedIn: boolean }) {
  const [step, setStep] = useState<"pick" | "form">("pick");
  const [layoutKey, setLayoutKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState<ResumeExperienceEntry[]>([{ ...emptyExperience }]);
  const [education, setEducation] = useState<ResumeEducationEntry[]>([{ ...emptyEducation }]);
  const [busy, setBusy] = useState(false);

  if (!isLoggedIn || !isPro) {
    return (
      <Modal open>
        <h2 className="font-heading text-lg font-bold text-foreground">Pro feature</h2>
        <p className="mt-2 text-sm text-muted">
          You need to go Pro to use Pro Resume Maker&apos;s premium templates.
        </p>
        <Link href="/pro" className="brand-pill-btn mt-5 block w-full py-3 text-sm">
          Go Pro
        </Link>
        <Link href="/" className="mt-3 block text-sm text-muted hover:underline">
          Back to Home
        </Link>
      </Modal>
    );
  }

  const skillList = skills.split(",").map((s) => s.trim()).filter(Boolean);

  function updateExperience(index: number, patch: Partial<ResumeExperienceEntry>) {
    setExperience((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateEducation(index: number, patch: Partial<ResumeEducationEntry>) {
    setEducation((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function handleGenerate() {
    if (!layoutKey) return;
    setBusy(true);
    try {
      const pdfBytes = await generateResumePdf(
        { name, title, email, phone, location, summary, skills: skillList, experience, education },
        layoutKey
      );
      downloadBlob(bytesToBlob(pdfBytes, "application/pdf"), `${name || "resume"}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  if (step === "pick") {
    return (
      <div>
        <h2 className="mb-4 font-heading text-lg font-bold text-foreground">Choose a template</h2>
        <TemplatePicker
          toolSlug="pro-resume-maker"
          onSelect={(key) => {
            setLayoutKey(key);
            setStep("form");
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setStep("pick")}
          className="text-sm font-medium text-brand-bright hover:underline"
        >
          ← Change template
        </button>

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
          onClick={handleGenerate}
          className="w-full rounded-lg brand-pill-btn py-3 transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
        >
          {busy ? "Processing..." : "Download Resume PDF"}
        </button>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted">
          Template: {layoutKey}
        </p>
        <div className="flex aspect-[210/297] w-full items-center justify-center rounded-lg bg-white p-8 text-slate-400 shadow-2xl ring-1 ring-black/10">
          Preview generated in the downloaded PDF
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
