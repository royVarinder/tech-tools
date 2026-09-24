# Pro Resume Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working, Pro-gated "Pro Resume Maker" tool with six selectable resume templates,
backed by an admin-manageable `Template` catalog — the first real consumer of the template
infrastructure, replacing the dead "coming soon" Pro Resume Maker homepage card.

**Architecture:** A `Template` Mongoose model + admin CRUD (mirrors Portal Links/FAQs exactly) +
a public read-only listing API. Visual style per template lives in a code lookup
(`resumeTemplateStyles.ts`), shared by a `TemplatePicker` gallery component and a parameterized
`generateResumePdf()` renderer (1-column and 2-column-sidebar variants), so the DB only catalogs
metadata while the actual PDF drawing recipe stays type-checked in code. A new small `Modal`
component gates the whole tool behind Pro status, checked server-side from the DB (not the JWT).

**Tech Stack:** Next.js 16 App Router, Mongoose, zod, pdf-lib, next-intl, Tailwind (`brand-*`
classes, 8px radius per the project's UI convention). No test framework exists in this repo —
every task's verification step is a concrete manual check (dev server + curl/browser + exact
expected output), not an automated test.

**Spec:** `docs/superpowers/specs/2026-09-24-pro-resume-maker-design.md`

## Global Constraints

- `Template.thumbnailUrl` is nullable — never fabricate a placeholder image URL; the picker
  renders a CSS mockup from `resumeTemplateStyles.ts` when it's null.
- Visual style (color/font/columns/header shape) lives only in `resumeTemplateStyles.ts`, never
  duplicated into the database.
- The Pro gate reads `User.isPro` fresh from the DB on the tool's page load, never the JWT claim.
- PDF generation stays 100% client-side via `pdf-lib` — no server file processing.
- Admin routes/pages under this feature follow the exact `requireAdminApi()`/`requireAdminPage()`
  guard pattern already used by every other `/admin/**` feature.
- Buttons and inputs use 8px radius (`rounded-lg` / the existing `.brand-pill-btn`/`.brand-input`
  classes), never `rounded-full`, per this project's UI convention.
- `npx tsc --noEmit` and `npm run build` (fresh `.next`) must pass after every task before
  committing.

## Review Focus

- A logged-out visitor and a logged-in non-Pro user hitting `/tools/pro-resume-maker` must both
  see the gate modal with no way to reach the template picker or form underneath — Task 6/7
  verify both cases, not just "not logged in."
- A Pro user who is later revoked must be gated again on their very next page load (DB-fresh
  check, not a stale JWT) — Task 7 verifies this by revoking mid-session and reloading.
- The public `GET /api/templates` with a `toolSlug` that has zero active templates (or a missing
  `toolSlug`) must return `[]`, not an error, so the picker degrades to an empty state rather
  than crashing — Task 1 verifies this directly.
- The 2-column `sidebar-dark` template must keep its sidebar band on a second page when the
  resume content is long enough to paginate — Task 3/6 verify this with a deliberately long
  resume (multiple experience entries with long descriptions).
- Deactivating a template in the admin panel must remove it from the public listing immediately
  (no caching) while leaving it selectable in no other way — Task 2 verifies the toggle's effect
  on the public API response, not just the admin table's own state.

---

### Task 1: `Template` model, public listing API, admin CRUD API

**Files:**
- Create: `src/models/Template.ts`
- Create: `src/app/api/templates/route.ts`
- Create: `src/app/api/admin/templates/route.ts`
- Create: `src/app/api/admin/templates/[id]/route.ts`

**Interfaces:**
- Produces: `Template` model (`{ _id, toolSlug, name, layoutKey, thumbnailUrl: string|null,
  description: string|null, order, active }`). `GET /api/templates?toolSlug=<slug>` →
  `{ id, name, layoutKey, thumbnailUrl, description }[]` (active only, sorted by order).
  `GET /api/admin/templates` → same shape plus `toolSlug`, `order`, `active`. `POST
  /api/admin/templates` body `{ toolSlug, name, layoutKey, thumbnailUrl?, description? }` → `{
  id }` (201). `PATCH /api/admin/templates/:id` body `{ name?, layoutKey?, thumbnailUrl?,
  description?, order?, active? }` → `{ id }`. `DELETE /api/admin/templates/:id` → `{ success:
  true }`.

- [ ] **Step 1: Create the `Template` model**

`src/models/Template.ts`:
```ts
import { Schema, model, models } from "mongoose";

export interface TemplateDoc {
  _id: string;
  toolSlug: string;
  name: string;
  layoutKey: string;
  thumbnailUrl: string | null;
  description: string | null;
  order: number;
  active: boolean;
}

const TemplateSchema = new Schema<TemplateDoc>(
  {
    toolSlug: { type: String, required: true, index: true },
    name: { type: String, required: true },
    layoutKey: { type: String, required: true },
    thumbnailUrl: { type: String, default: null },
    description: { type: String, default: null },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export const Template = models.Template || model<TemplateDoc>("Template", TemplateSchema);
export default Template;
```

- [ ] **Step 2: Public listing route**

`src/app/api/templates/route.ts`:
```ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Template from "@/models/Template";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const toolSlug = searchParams.get("toolSlug");
  if (!toolSlug) {
    return NextResponse.json([]);
  }

  await connectToDatabase();
  const templates = await Template.find({ toolSlug, active: true }).sort({ order: 1 }).lean();

  return NextResponse.json(
    templates.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      layoutKey: t.layoutKey,
      thumbnailUrl: t.thumbnailUrl,
      description: t.description,
    }))
  );
}
```

- [ ] **Step 3: Admin list/create route**

`src/app/api/admin/templates/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Template from "@/models/Template";

const createSchema = z.object({
  toolSlug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  layoutKey: z.string().min(1).max(80),
  thumbnailUrl: z.string().url().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const guard = await requireAdminApi();
  if (guard) return guard;

  await connectToDatabase();
  const templates = await Template.find().sort({ toolSlug: 1, order: 1 }).lean();

  return NextResponse.json(
    templates.map((t) => ({
      id: t._id.toString(),
      toolSlug: t.toolSlug,
      name: t.name,
      layoutKey: t.layoutKey,
      thumbnailUrl: t.thumbnailUrl,
      description: t.description,
      order: t.order,
      active: t.active,
    }))
  );
}

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template data." }, { status: 400 });
  }

  await connectToDatabase();
  const count = await Template.countDocuments({ toolSlug: parsed.data.toolSlug });
  const template = await Template.create({
    ...parsed.data,
    thumbnailUrl: parsed.data.thumbnailUrl ?? null,
    description: parsed.data.description ?? null,
    order: count,
  });

  return NextResponse.json({ id: template._id.toString() }, { status: 201 });
}
```

- [ ] **Step 4: Admin update/delete route**

`src/app/api/admin/templates/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Template from "@/models/Template";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  layoutKey: z.string().min(1).max(80).optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  order: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template data." }, { status: 400 });
  }

  await connectToDatabase();
  const template = await Template.findByIdAndUpdate(id, { $set: parsed.data }, { new: true }).lean();
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ id: template._id.toString() });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  await connectToDatabase();
  const result = await Template.findByIdAndDelete(id);
  if (!result) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Start `npm run dev`.
1. `curl -s http://localhost:3002/api/templates` (no `toolSlug`) — expect `[]`.
2. `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/api/admin/templates` with no
   cookies — expect `401`.
3. As admin (browser fetch or curl with an admin session cookie), `POST
   /api/admin/templates` with `{"toolSlug":"pro-resume-maker","name":"Test","layoutKey":"classic"}`
   — expect `201` and an `id`. `GET /api/templates?toolSlug=pro-resume-maker` — expect the new
   template listed. `PATCH` it with `{"active":false}`, then re-`GET
   /api/templates?toolSlug=pro-resume-maker` — expect it gone from the public list (Review Focus:
   deactivation removes it from the public listing). `DELETE` it to clean up.

- [ ] **Step 7: Commit**

```bash
git add src/models/Template.ts src/app/api/templates src/app/api/admin/templates
git commit -m "Add Template model, public listing API, and admin CRUD routes"
```

---

### Task 2: Admin Templates UI, nav entry, seed script

**Files:**
- Create: `src/app/admin/templates/page.tsx`
- Create: `src/components/admin/TemplatesManager.tsx`
- Modify: `src/components/admin/AdminShell.tsx`
- Create: `scripts/seed-templates.mjs`
- Modify: `package.json` (add `seed:templates` script)

**Interfaces:**
- Consumes: `requireAdminPage()`, `AdminShell` (existing), `/api/admin/templates` (Task 1).
- Produces: seeded `Template` documents for `toolSlug: "pro-resume-maker"` (6 rows) that Task 6's
  `TemplatePicker` will read via the public API.

- [ ] **Step 1: Admin templates page**

`src/app/admin/templates/page.tsx`:
```tsx
import { requireAdminPage } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Template from "@/models/Template";
import AdminShell from "@/components/admin/AdminShell";
import TemplatesManager from "@/components/admin/TemplatesManager";

export default async function AdminTemplatesPage() {
  const session = await requireAdminPage();

  await connectToDatabase();
  const templates = await Template.find().sort({ toolSlug: 1, order: 1 }).lean();

  const initialTemplates = templates.map((t) => ({
    id: t._id.toString(),
    toolSlug: t.toolSlug,
    name: t.name,
    layoutKey: t.layoutKey,
    thumbnailUrl: t.thumbnailUrl,
    description: t.description,
    order: t.order,
    active: t.active,
  }));

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">Templates</h1>
      <p className="mt-1 text-sm text-muted">
        Manage the template catalog offered inside creative tools (e.g. Pro Resume Maker).
      </p>
      <TemplatesManager initialTemplates={initialTemplates} />
    </AdminShell>
  );
}
```

- [ ] **Step 2: Templates manager client component**

`src/components/admin/TemplatesManager.tsx`:
```tsx
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
```

- [ ] **Step 3: Add the nav entry**

In `src/components/admin/AdminShell.tsx`, add to `NAV_ITEMS` (after `"FAQs"`):
```ts
const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/pro-applications", label: "Pro Applications" },
  { href: "/admin/visitors", label: "Visitors" },
  { href: "/admin/portal-links", label: "Portal Links" },
  { href: "/admin/faqs", label: "FAQs" },
  { href: "/admin/templates", label: "Templates" },
];
```

- [ ] **Step 4: Seed the six Pro Resume Maker templates**

`scripts/seed-templates.mjs`:
```js
import { existsSync } from "node:fs";
import mongoose from "mongoose";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/toolnest";
const MONGODB_DB = process.env.MONGODB_DB || "toolnest";

const TemplateSchema = new mongoose.Schema(
  {
    toolSlug: { type: String, required: true, index: true },
    name: { type: String, required: true },
    layoutKey: { type: String, required: true },
    thumbnailUrl: { type: String, default: null },
    description: { type: String, default: null },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

const RESUME_TEMPLATES = [
  { name: "Classic Serif", layoutKey: "classic", description: "Traditional single-column layout with serif headings." },
  { name: "Modern Blue", layoutKey: "modern-blue", description: "Clean single-column design with a blue banner header." },
  { name: "Minimalist", layoutKey: "minimalist", description: "Lots of whitespace and understated typography." },
  { name: "Sidebar Dark", layoutKey: "sidebar-dark", description: "Two-column layout with a dark sidebar for contact and skills." },
  { name: "Bold Header", layoutKey: "bold-header", description: "Large colored header banner with bold typography." },
  { name: "Elegant Green", layoutKey: "elegant-green", description: "Elegant serif design with green accents." },
];

async function seed() {
  console.log(`Connecting to database "${MONGODB_DB}" ...`);
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
  const Template = mongoose.models.Template || mongoose.model("Template", TemplateSchema);

  for (const [index, template] of RESUME_TEMPLATES.entries()) {
    await Template.findOneAndUpdate(
      { toolSlug: "pro-resume-maker", layoutKey: template.layoutKey },
      { $set: { ...template, toolSlug: "pro-resume-maker", order: index, active: true } },
      { upsert: true }
    );
    console.log(`Upserted template: ${template.name}`);
  }

  console.log("Template seeding complete.");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Template seed failed:", err);
  process.exit(1);
});
```

Add to `package.json` `"scripts"`: `"seed:templates": "node scripts/seed-templates.mjs"`.

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 6: Run the seed and verify in the admin panel**

Run: `npm run seed:templates`
Expected: 6 "Upserted template" lines, exits 0.

Visit `/admin/templates` as admin — confirm 6 rows for `pro-resume-maker`, all active. Toggle one
to "Deactivate" — confirm `GET /api/templates?toolSlug=pro-resume-maker` now returns 5 (Review
Focus: deactivation removes it from the public listing) — then toggle it back to "Activate".

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/templates src/components/admin/TemplatesManager.tsx src/components/admin/AdminShell.tsx scripts/seed-templates.mjs package.json
git commit -m "Add admin Templates UI and seed the six Pro Resume Maker templates"
```

---

### Task 3: Resume template styles + PDF renderer

**Files:**
- Create: `src/lib/resumeTemplateStyles.ts`
- Create: `src/lib/generateResumePdf.ts`

**Interfaces:**
- Produces: `ResumeTemplateStyle` interface, `RESUME_TEMPLATE_STYLES: Record<string,
  ResumeTemplateStyle>` (keyed by the six `layoutKey`s seeded in Task 2). `ResumeData`,
  `ResumeExperienceEntry`, `ResumeEducationEntry` interfaces. `generateResumePdf(data:
  ResumeData, layoutKey: string): Promise<Uint8Array>` — Task 6 calls this directly; Task 5's
  `TemplatePicker` reads `RESUME_TEMPLATE_STYLES` for preview swatches.

- [ ] **Step 1: Style lookup**

`src/lib/resumeTemplateStyles.ts`:
```ts
export interface ResumeTemplateStyle {
  layoutKey: string;
  accentColor: [number, number, number];
  accentColorCss: string;
  fontFamily: "Helvetica" | "TimesRoman";
  columns: 1 | 2;
  headerStyle: "minimal" | "banner" | "sidebar";
}

export const RESUME_TEMPLATE_STYLES: Record<string, ResumeTemplateStyle> = {
  classic: {
    layoutKey: "classic",
    accentColor: [0.24, 0.28, 0.35],
    accentColorCss: "#3d4759",
    fontFamily: "TimesRoman",
    columns: 1,
    headerStyle: "minimal",
  },
  "modern-blue": {
    layoutKey: "modern-blue",
    accentColor: [0.145, 0.388, 0.922],
    accentColorCss: "#2563eb",
    fontFamily: "Helvetica",
    columns: 1,
    headerStyle: "banner",
  },
  minimalist: {
    layoutKey: "minimalist",
    accentColor: [0.45, 0.45, 0.48],
    accentColorCss: "#737480",
    fontFamily: "Helvetica",
    columns: 1,
    headerStyle: "minimal",
  },
  "sidebar-dark": {
    layoutKey: "sidebar-dark",
    accentColor: [0.12, 0.13, 0.16],
    accentColorCss: "#1f2128",
    fontFamily: "Helvetica",
    columns: 2,
    headerStyle: "sidebar",
  },
  "bold-header": {
    layoutKey: "bold-header",
    accentColor: [0.42, 0.15, 0.55],
    accentColorCss: "#6b268c",
    fontFamily: "Helvetica",
    columns: 1,
    headerStyle: "banner",
  },
  "elegant-green": {
    layoutKey: "elegant-green",
    accentColor: [0.11, 0.42, 0.28],
    accentColorCss: "#1c6b47",
    fontFamily: "TimesRoman",
    columns: 1,
    headerStyle: "minimal",
  },
};

export function getResumeTemplateStyle(layoutKey: string): ResumeTemplateStyle {
  return RESUME_TEMPLATE_STYLES[layoutKey] ?? RESUME_TEMPLATE_STYLES.classic;
}
```

- [ ] **Step 2: PDF renderer**

`src/lib/generateResumePdf.ts`:
```ts
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getResumeTemplateStyle } from "./resumeTemplateStyles";

export interface ResumeExperienceEntry {
  company: string;
  role: string;
  period: string;
  description: string;
}

export interface ResumeEducationEntry {
  school: string;
  degree: string;
  period: string;
}

export interface ResumeData {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  experience: ResumeExperienceEntry[];
  education: ResumeEducationEntry[];
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const SIDEBAR_WIDTH = 190;

export async function generateResumePdf(data: ResumeData, layoutKey: string): Promise<Uint8Array> {
  const style = getResumeTemplateStyle(layoutKey);
  const isSerif = style.fontFamily === "TimesRoman";

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(isSerif ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(isSerif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold);
  const accent = rgb(...style.accentColor);
  const hasSidebar = style.columns === 2;
  const leftX = MARGIN + (hasSidebar ? SIDEBAR_WIDTH : 0);
  const rightEdge = PAGE_WIDTH - MARGIN;
  const contentWidth = rightEdge - leftX;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function drawSidebarBackground(target: PDFPage) {
    if (!hasSidebar) return;
    target.drawRectangle({
      x: 0,
      y: 0,
      width: SIDEBAR_WIDTH + MARGIN,
      height: PAGE_HEIGHT,
      color: accent,
    });
  }
  drawSidebarBackground(page);
  const firstPage = page;

  function newPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawSidebarBackground(page);
    y = PAGE_HEIGHT - MARGIN;
  }

  function ensureSpace(lineHeight: number) {
    if (y - lineHeight < MARGIN) newPage();
  }

  function drawWrapped(
    text: string,
    x: number,
    width: number,
    options: { size: number; font: PDFFont; color?: ReturnType<typeof rgb>; gap?: number }
  ) {
    const { size, font: usedFont, color = rgb(0.15, 0.15, 0.18), gap = size * 1.4 } = options;
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const w = usedFont.widthOfTextAtSize(testLine, size);
      if (w > width && line) {
        ensureSpace(gap);
        page.drawText(line, { x, y, size, font: usedFont, color });
        y -= gap;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ensureSpace(gap);
      page.drawText(line, { x, y, size, font: usedFont, color });
      y -= gap;
    }
  }

  function drawHeading(text: string) {
    ensureSpace(26);
    y -= 6;
    page.drawText(text.toUpperCase(), { x: leftX, y, size: 12, font: boldFont, color: accent });
    y -= 4;
    page.drawLine({
      start: { x: leftX, y },
      end: { x: rightEdge, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.9),
    });
    y -= 14;
  }

  // Header
  if (style.headerStyle === "banner") {
    const bannerHeight = 90;
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - bannerHeight, width: PAGE_WIDTH, height: bannerHeight, color: accent });
    page.drawText(data.name || "Your Name", { x: MARGIN, y: PAGE_HEIGHT - 40, size: 24, font: boldFont, color: rgb(1, 1, 1) });
    if (data.title) {
      page.drawText(data.title, { x: MARGIN, y: PAGE_HEIGHT - 68, size: 13, font, color: rgb(0.95, 0.95, 0.98) });
    }
    y = PAGE_HEIGHT - bannerHeight - 24;
    const contactLine = [data.email, data.phone, data.location].filter(Boolean).join("   •   ");
    if (contactLine) {
      page.drawText(contactLine, { x: MARGIN, y, size: 10, font, color: rgb(0.4, 0.4, 0.45) });
      y -= 20;
    }
  } else if (style.headerStyle === "sidebar") {
    let sy = PAGE_HEIGHT - MARGIN + 10;
    const sbX = 20;
    sy -= 10;
    firstPage.drawText(data.name || "Your Name", { x: sbX, y: sy, size: 16, font: boldFont, color: rgb(1, 1, 1) });
    sy -= 22;
    if (data.title) {
      firstPage.drawText(data.title, { x: sbX, y: sy, size: 10, font, color: rgb(0.85, 0.85, 0.9) });
      sy -= 24;
    } else {
      sy -= 10;
    }
    if (data.email || data.phone || data.location) {
      firstPage.drawText("CONTACT", { x: sbX, y: sy, size: 9, font: boldFont, color: rgb(1, 1, 1) });
      sy -= 16;
      for (const line of [data.email, data.phone, data.location].filter(Boolean)) {
        firstPage.drawText(line, { x: sbX, y: sy, size: 9, font, color: rgb(0.85, 0.85, 0.9) });
        sy -= 14;
      }
      sy -= 10;
    }
    if (data.skills.length > 0) {
      firstPage.drawText("SKILLS", { x: sbX, y: sy, size: 9, font: boldFont, color: rgb(1, 1, 1) });
      sy -= 16;
      for (const skill of data.skills) {
        firstPage.drawText(`• ${skill}`, { x: sbX, y: sy, size: 9, font, color: rgb(0.85, 0.85, 0.9) });
        sy -= 14;
      }
    }
    y = PAGE_HEIGHT - MARGIN;
  } else {
    page.drawText(data.name || "Your Name", { x: leftX, y, size: 22, font: boldFont, color: rgb(0.1, 0.1, 0.15) });
    y -= 26;
    if (data.title) {
      page.drawText(data.title, { x: leftX, y, size: 13, font, color: accent });
      y -= 20;
    }
    const contactLine = [data.email, data.phone, data.location].filter(Boolean).join("   •   ");
    if (contactLine) {
      page.drawText(contactLine, { x: leftX, y, size: 10, font, color: rgb(0.4, 0.4, 0.45) });
      y -= 20;
    }
  }

  if (data.summary) {
    drawHeading("Summary");
    drawWrapped(data.summary, leftX, contentWidth, { size: 10.5, font });
    y -= 6;
  }

  const experienceEntries = data.experience.filter((e) => e.company || e.role);
  if (experienceEntries.length > 0) {
    drawHeading("Experience");
    for (const exp of experienceEntries) {
      ensureSpace(16);
      page.drawText(`${exp.role || "Role"} — ${exp.company || "Company"}`, {
        x: leftX,
        y,
        size: 11,
        font: boldFont,
      });
      if (exp.period) {
        const periodWidth = font.widthOfTextAtSize(exp.period, 9.5);
        page.drawText(exp.period, {
          x: rightEdge - periodWidth,
          y,
          size: 9.5,
          font,
          color: rgb(0.45, 0.45, 0.5),
        });
      }
      y -= 16;
      if (exp.description) {
        drawWrapped(exp.description, leftX, contentWidth, { size: 10, font, color: rgb(0.3, 0.3, 0.35) });
      }
      y -= 6;
    }
  }

  const educationEntries = data.education.filter((e) => e.school || e.degree);
  if (educationEntries.length > 0) {
    drawHeading("Education");
    for (const edu of educationEntries) {
      ensureSpace(16);
      page.drawText(`${edu.degree || "Degree"} — ${edu.school || "School"}`, {
        x: leftX,
        y,
        size: 11,
        font: boldFont,
      });
      if (edu.period) {
        const periodWidth = font.widthOfTextAtSize(edu.period, 9.5);
        page.drawText(edu.period, {
          x: rightEdge - periodWidth,
          y,
          size: 9.5,
          font,
          color: rgb(0.45, 0.45, 0.5),
        });
      }
      y -= 20;
    }
  }

  if (data.skills.length > 0 && !hasSidebar) {
    drawHeading("Skills");
    drawWrapped(data.skills.join("   •   "), leftX, contentWidth, { size: 10.5, font });
  }

  return pdfDoc.save();
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/resumeTemplateStyles.ts src/lib/generateResumePdf.ts
git commit -m "Add resume template style lookup and parameterized PDF renderer"
```

(Manual verification of actual PDF output happens in Task 6, once a UI calls this function.)

---

### Task 4: Reusable `Modal` component

**Files:**
- Create: `src/components/Modal.tsx`

**Interfaces:**
- Produces: `Modal({ open: boolean, children: React.ReactNode })` — renders a centered
  backdrop+panel when `open`, nothing when not. No close-on-backdrop-click (the Pro gate in Task
  6 must not be dismissible into the tool).

- [ ] **Step 1: Create the component**

`src/components/Modal.tsx`:
```tsx
"use client";

export default function Modal({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="brand-card w-full max-w-sm p-6 text-center shadow-2xl">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Modal.tsx
git commit -m "Add reusable Modal component"
```

(Manual verification happens in Task 6, where it's first used.)

---

### Task 5: `TemplatePicker` component

**Files:**
- Create: `src/components/tools/TemplatePicker.tsx`

**Interfaces:**
- Consumes: `GET /api/templates?toolSlug=<slug>` (Task 1), `RESUME_TEMPLATE_STYLES` (Task 3, for
  the preview swatch only — this component is generic enough to reuse for other tools later, but
  only resume-shaped previews exist today).
- Produces: `TemplatePicker({ toolSlug: string, onSelect: (layoutKey: string) => void })`.

- [ ] **Step 1: Create the component**

`src/components/tools/TemplatePicker.tsx`:
```tsx
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
```

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/TemplatePicker.tsx
git commit -m "Add TemplatePicker gallery component"
```

(Manual verification happens in Task 6, where it's first rendered on a real page.)

---

### Task 6: `ProResumeMaker` tool component (Pro gate + picker + form)

**Files:**
- Create: `src/components/tools/ProResumeMaker.tsx`

**Interfaces:**
- Consumes: `Modal` (Task 4), `TemplatePicker` (Task 5), `generateResumePdf`/`ResumeData` (Task
  3), `downloadBlob`/`bytesToBlob` (existing `src/lib/download.ts`).
- Produces: `ProResumeMaker({ isPro: boolean, isLoggedIn: boolean })` — Task 7 wires this into
  the tool page with server-checked props.

- [ ] **Step 1: Create the component**

`src/components/tools/ProResumeMaker.tsx`:
```tsx
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
          You need to go Pro to use Pro Resume Maker's premium templates.
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
```

*(Note: this component is intentionally not yet reachable from a page — Task 7 wires it into
the tools registry and the tool page. Its own manual verification happens there.)*

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed (the component compiles even though nothing imports it yet — Task 7
removes that gap in the same session, so this is not a dangling dead-code state for long).

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/ProResumeMaker.tsx
git commit -m "Add ProResumeMaker tool component (Pro gate, template step, resume form)"
```

---

### Task 7: Wire the tool into every registry, the tool page, and translations

**Files:**
- Modify: `src/lib/toolsRegistry.ts`
- Modify: `scripts/seed-tools.mjs`
- Modify: `src/components/ToolIcon.tsx`
- Modify: `src/app/[locale]/(site)/tools/[slug]/page.tsx`
- Modify: `src/lib/homeContentSeed.ts`
- Modify: `scripts/seed-home-content.mjs`
- Modify: `src/messages/en.json`, `src/messages/hin.json`, `src/messages/pun.json`

**Interfaces:**
- Consumes: `ProResumeMaker` (Task 6), `auth()` (existing), `User` model (existing, `isPro`
  field from the Pro access workflow).
- Produces: a live, navigable `/tools/pro-resume-maker` page and a working homepage card.

- [ ] **Step 1: Add the tool to the registry**

In `src/lib/toolsRegistry.ts`, add to `TOOL_DEFINITIONS`:
```ts
  { slug: "pro-resume-maker", category: "document", icon: "pro-resume-maker", order: 11 },
```

- [ ] **Step 2: Add the tool to the DB seed script**

In `scripts/seed-tools.mjs`, add to `TOOL_DEFINITIONS`:
```js
  { slug: "pro-resume-maker", category: "document", icon: "pro-resume-maker", order: 11 },
```

- [ ] **Step 3: Add the icon**

In `src/components/ToolIcon.tsx`, add to the `icons` map:
```ts
  "pro-resume-maker": FcDocument,
```

- [ ] **Step 4: Pass Pro status into the tool page**

Replace `src/app/[locale]/(site)/tools/[slug]/page.tsx` with:
```tsx
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FcLeft } from "react-icons/fc";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import { TOOL_DEFINITIONS } from "@/lib/toolsRegistry";
import ToolIcon from "@/components/ToolIcon";
import RecordToolUsage from "@/components/tools/RecordToolUsage";
import ImageToPdf from "@/components/tools/ImageToPdf";
import PngToJpg from "@/components/tools/PngToJpg";
import PdfToJpg from "@/components/tools/PdfToJpg";
import MergePdf from "@/components/tools/MergePdf";
import DeletePdfPage from "@/components/tools/DeletePdfPage";
import PhotoCropResize from "@/components/tools/PhotoCropResize";
import ResumeMaker from "@/components/tools/ResumeMaker";
import PassportPhoto from "@/components/tools/PassportPhoto";
import IdCardPrint from "@/components/tools/IdCardPrint";
import ProResumeMaker from "@/components/tools/ProResumeMaker";

export function generateStaticParams() {
  return TOOL_DEFINITIONS.map((tool) => ({ slug: tool.slug }));
}

async function renderTool(slug: string) {
  switch (slug) {
    case "jpg-to-pdf":
      return <ImageToPdf format="jpg" />;
    case "png-to-pdf":
      return <ImageToPdf format="png" />;
    case "png-to-jpg":
      return <PngToJpg />;
    case "pdf-to-jpg":
      return <PdfToJpg />;
    case "merge-pdf":
      return <MergePdf />;
    case "delete-pdf-page":
      return <DeletePdfPage />;
    case "photo-crop-resize":
      return <PhotoCropResize />;
    case "resume-maker":
      return <ResumeMaker />;
    case "passport-photo":
      return <PassportPhoto />;
    case "id-card-print":
      return <IdCardPrint />;
    case "pro-resume-maker": {
      const session = await auth();
      const isLoggedIn = Boolean(session?.user?.id);
      let isPro = false;
      if (isLoggedIn) {
        await connectToDatabase();
        const user = await User.findById(session!.user.id).lean();
        isPro = Boolean(user?.isPro);
      }
      return <ProResumeMaker isPro={isPro} isLoggedIn={isLoggedIn} />;
    }
    default:
      return null;
  }
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const definition = TOOL_DEFINITIONS.find((tool) => tool.slug === slug);
  if (!definition) notFound();

  const t = await getTranslations({ locale, namespace: "tools" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const toolUi = await renderTool(slug);
  if (!toolUi) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <RecordToolUsage slug={slug} />
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-bright transition-transform hover:-translate-x-0.5 hover:underline"
      >
        <FcLeft className="h-4 w-4" /> {tCommon("back")}
      </Link>

      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-soft">
          <ToolIcon slug={slug} className="h-7 w-7" />
        </span>
        <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
          {t(`${slug}.name` as never)}
        </h1>
      </div>
      <p className="mb-8 text-muted">{t(`${slug}.description` as never)}</p>

      {toolUi}
    </div>
  );
}
```

- [ ] **Step 5: Give the homepage card a real link**

In `src/lib/homeContentSeed.ts`, in the `creative-design-studio` category's items, change:
```ts
      { title: "Pro Resume Maker", badge: "NEW" },
```
to:
```ts
      { title: "Pro Resume Maker", badge: "NEW", href: "/tools/pro-resume-maker" },
```

In `scripts/seed-home-content.mjs`, in the `creative-design-studio` `buildItems(...)` call, make
the identical change:
```js
    { title: "Pro Resume Maker", badge: "NEW", href: "/tools/pro-resume-maker" },
```

- [ ] **Step 6: Add translations**

In `src/messages/en.json`, add to `tools`:
```json
    "pro-resume-maker": { "name": "Pro Resume Maker", "description": "Choose from premium resume templates and build a polished, professional resume as a PDF. Pro members only." },
```

In `src/messages/hin.json`, add to `tools`:
```json
    "pro-resume-maker": { "name": "प्रो रिज्यूमे मेकर", "description": "प्रीमियम रिज्यूमे टेम्पलेट्स में से चुनें और एक शानदार, पेशेवर रिज्यूमे PDF के रूप में बनाएं। केवल प्रो सदस्यों के लिए।" },
```

In `src/messages/pun.json`, add to `tools`:
```json
    "pro-resume-maker": { "name": "ਪ੍ਰੋ ਰਿਜ਼ਿਊਮੇ ਮੇਕਰ", "description": "ਪ੍ਰੀਮੀਅਮ ਰਿਜ਼ਿਊਮੇ ਟੈਂਪਲੇਟਾਂ ਵਿੱਚੋਂ ਚੁਣੋ ਅਤੇ ਇੱਕ ਸ਼ਾਨਦਾਰ, ਪੇਸ਼ੇਵਰ ਰਿਜ਼ਿਊਮੇ PDF ਵਜੋਂ ਬਣਾਓ। ਸਿਰਫ਼ ਪ੍ਰੋ ਮੈਂਬਰਾਂ ਲਈ।" },
```

- [ ] **Step 7: Re-seed tools and home content**

Run: `npm run seed:tools && npm run seed:content`
Expected: `Upserted tool: pro-resume-maker` printed, and the "Pro Resume Maker" service upsert
included in the home-content run; both exit 0.

- [ ] **Step 8: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed, and the route list includes `/[locale]/tools/[slug]` still generating
`pro-resume-maker` as one of its static params.

- [ ] **Step 9: Manual verification (full flow, all three Review Focus cases)**

Start `npm run dev`.
1. Visit `/en` — confirm the "Pro Resume Maker" card in Creative Design Studio is no longer
   "Coming soon" and links to `/tools/pro-resume-maker`.
2. Visit `/en/tools/pro-resume-maker` logged out — confirm the gate modal appears with "Go Pro"
   and "Back to Home" links, and no template picker or form is visible behind it.
3. Log in as a non-Pro test user, revisit the page — confirm the same gate modal appears (Review
   Focus: non-Pro, not just logged-out, is gated).
4. Approve that user's Pro status (via `/admin/pro-applications` or the `/admin/users` toggle
   from the earlier Pro workflow), revisit the page — confirm the template picker renders with 6
   cards, each showing a distinct color/layout preview.
5. Pick "Sidebar Dark", fill in the form with enough experience/education entries with long
   descriptions to force a second page, click "Download Resume PDF" — open the downloaded PDF
   and confirm the dark sidebar band appears on **both** pages (Review Focus: pagination keeps
   the sidebar).
6. Go back (browser back or "Change template"), pick a 1-column template (e.g. "Bold Header"),
   generate again — confirm the banner header renders and the PDF looks visually distinct from
   the sidebar template.
7. In the admin panel, revoke that user's Pro status, reload `/en/tools/pro-resume-maker` as
   them — confirm the gate modal reappears immediately (Review Focus: DB-fresh check, not a
   stale JWT).

- [ ] **Step 10: Commit**

```bash
git add src/lib/toolsRegistry.ts scripts/seed-tools.mjs src/components/ToolIcon.tsx "src/app/[locale]/(site)/tools/[slug]/page.tsx" src/lib/homeContentSeed.ts scripts/seed-home-content.mjs src/messages/en.json src/messages/hin.json src/messages/pun.json
git commit -m "Wire Pro Resume Maker into the tools registry, tool page, and homepage card"
```
