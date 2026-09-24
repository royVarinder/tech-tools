# Pro Resume Maker (Templates + First Creative Tool) — Design Spec

Date: 2026-09-24
Status: Approved

## Purpose

Sub-project 2 (template infrastructure) and the first tool of sub-project 3, built together:
a working "Pro Resume Maker" tool, gated behind Pro access, that lets a Pro user pick from six
resume templates and fill in the same resume data to generate a styled PDF — plus the
admin-manageable `Template` catalog that backs it. This replaces the dead "coming soon" Pro
Resume Maker card already seeded in the `creative-design-studio` homepage category.

## Non-goals

- No changes to the existing free `resume-maker` tool — Pro Resume Maker is a separate,
  additional tool (`pro-resume-maker` slug), matching the homepage's existing distinct cards
  for "Resume/CV" (Essential & Services) and "Pro Resume Maker" (Creative Design Studio).
- No real uploaded thumbnail images — `Template.thumbnailUrl` is a nullable field admins *can*
  fill in later with a real image URL, but the picker UI works without one (see Architecture §3).
- No server-side PDF rendering — generation stays 100% client-side via `pdf-lib`, consistent
  with every other tool in this app.
- The other 5 Creative Design Studio tools (Marriage Biodata, Pro ID Maker, etc.) are out of
  scope — this spec covers Pro Resume Maker only; later tools reuse the `Template`
  infrastructure this spec builds.

## Architecture

### 1. `Template` model and admin CRUD

- `src/models/Template.ts`: `{ toolSlug: string, name: string, layoutKey: string,
  thumbnailUrl: string | null, description: string | null, order: number, active: boolean }`,
  timestamps. `toolSlug` is a free string (not FK-enforced, matching `Service.categorySlug`'s
  existing convention) — for this spec, always `"pro-resume-maker"`.
- Admin CRUD at `src/app/admin/templates/page.tsx` + `TemplatesManager.tsx`, backed by
  `src/app/api/admin/templates/route.ts` (GET list, POST create) and
  `src/app/api/admin/templates/[id]/route.ts` (PATCH, DELETE) — identical shape to the existing
  Portal Links / FAQs admin features (`requireAdminApi()` guard, zod validation, server-component
  page + client table). `AdminShell` nav gains a "Templates" entry.
- `src/app/api/templates/route.ts`: public `GET ?toolSlug=<slug>` → active templates for that
  tool, sorted by `order`, unauthenticated (matches the existing public `/api/tools` convention —
  listing isn't sensitive; the Pro gate is enforced on the tool page itself, §4).
- `scripts/seed-templates.mjs` (+ `"seed:templates"` npm script) seeds the six templates below
  for `toolSlug: "pro-resume-maker"`, `thumbnailUrl: null` (the picker renders a generated CSS
  preview instead — no placeholder image URLs are fabricated).

### 2. Visual style lives in code, not the database

`Template.layoutKey` is a cataloging key; the actual visual recipe for each key is a fixed
lookup in `src/lib/resumeTemplateStyles.ts`, shared by both the PDF renderer and the picker's
preview cards — single source of truth, type-checked, no free-form JSON in Mongo:

```ts
export interface ResumeTemplateStyle {
  layoutKey: string;
  accentColor: [number, number, number]; // 0-1 rgb, for pdf-lib
  accentColorCss: string;                // hex, for the React preview swatch
  headingFont: "Helvetica" | "HelveticaBold" | "TimesRomanBold" | "TimesRoman";
  bodyFont: "Helvetica" | "TimesRoman";
  columns: 1 | 2;
  headerStyle: "minimal" | "banner" | "sidebar";
}
```

Six entries, seeded 1:1 with the six `Template` documents:

| layoutKey | name | columns | headerStyle | accent |
|---|---|---|---|---|
| `classic` | Classic Serif | 1 | minimal | slate |
| `modern-blue` | Modern Blue | 1 | banner | blue |
| `minimalist` | Minimalist | 1 | minimal | muted gray, wider spacing |
| `sidebar-dark` | Sidebar Dark | 2 | sidebar | near-black sidebar |
| `bold-header` | Bold Header | 1 | banner | deep purple, larger banner |
| `elegant-green` | Elegant Green | 1 | minimal | green, serif |

### 3. Template picker (no real images required)

`src/components/tools/TemplatePicker.tsx`: fetches `GET /api/templates?toolSlug=pro-resume-maker`,
renders a responsive card grid. Each card renders a small CSS mockup built from
`RESUME_TEMPLATE_STYLES[layoutKey]` (a colored bar/sidebar block using `accentColorCss` and
`headerStyle`, mimicking the real PDF's header shape) when `thumbnailUrl` is null, or the real
image when an admin has set one — plus the template's `name`, `description`, and a "Use this
template" button. `onSelect(layoutKey: string)` prop.

### 4. Pro gate

`src/app/[locale]/(site)/tools/[slug]/page.tsx` (server component) calls `auth()` (already
imported pattern from the home page) and, only for `slug === "pro-resume-maker"`, passes
`isPro: boolean` (from a fresh `User.findById` DB read, not the JWT claim — same rule as the
`/pro` page) and `isLoggedIn: boolean` into `ProResumeMaker`. Other tools are unaffected.

`ProResumeMaker.tsx`: if `!isLoggedIn || !isPro`, renders nothing but a centered modal
(`src/components/Modal.tsx`, new small reusable backdrop+panel component, this app's first) with
the message "You need to go Pro to use this feature," a primary button linking to `/pro`, and a
secondary "Back to Home" link — no path to the template picker or form underneath. This is a
UX-level gate consistent with this app's existing security posture (every tool is 100%
client-side already; there is no server secret to protect either way).

### 5. `ProResumeMaker.tsx` tool flow (Pro users only)

Two-step client component, adapted from the existing `ResumeMaker.tsx` (same field set: name,
title, email, phone, location, summary, skills, experience[], education[]; same `Input`/
`Textarea`/`Section` local helper pattern):

- **Step "pick"**: renders `TemplatePicker`. Selecting a template sets `layoutKey` and advances
  to "form".
- **Step "form"**: the resume form (identical fields to `ResumeMaker.tsx`) plus a "Change
  template" link back to "pick", and a live A4 preview panel (reusing the existing preview
  pattern) that reflects the selected template's `columns`/`accentColorCss` so the user sees a
  layout hint before generating. Generate button calls
  `generateResumePdf(data, layoutKey)` and downloads the result — same
  `downloadBlob`/`bytesToBlob` helpers as every other tool.

### 6. PDF renderer

`src/lib/generateResumePdf.ts` exports `generateResumePdf(data: ResumeData, layoutKey: string):
Promise<Uint8Array>`, refactored from `ResumeMaker.tsx`'s existing `generatePdf` logic and
parameterized by `RESUME_TEMPLATE_STYLES[layoutKey]`:

- **1-column layouts** (`classic`, `modern-blue`, `minimalist`, `bold-header`, `elegant-green`):
  same overall structure as today's Resume Maker (header → summary → experience → education →
  skills), but heading font/body font/accent color come from the style, and `headerStyle:
  "banner"` draws a colored rectangle behind the name/title block before drawing text (vs.
  `"minimal"` drawing straight onto the page background).
- **2-column layout** (`sidebar-dark`): a left sidebar (~35% page width, filled with the accent
  color) holding contact info and the skills list; the right column holds name/title, summary,
  experience, and education. The shared `ensureSpace`/`drawWrapped` helpers are parameterized
  with a `leftX`/`rightEdge` pair per column so both routines reuse the same wrapping/pagination
  logic; `ensureSpace` redraws the sidebar background rectangle whenever it creates a new page,
  so a multi-page sidebar resume keeps its sidebar on every page.

### 7. Wiring the new tool into existing registries

- `src/lib/toolsRegistry.ts` and `scripts/seed-tools.mjs` (duplicate arrays, existing pattern):
  add `{ slug: "pro-resume-maker", category: "document", icon: "pro-resume-maker", order: 11 }`.
- `src/components/ToolIcon.tsx`: add `"pro-resume-maker": FcDocument` (falls back to `FcDocument`
  automatically even without this, but explicit for clarity).
- `src/app/[locale]/(site)/tools/[slug]/page.tsx`: import and render `ProResumeMaker` for the
  new slug, passing the `isPro`/`isLoggedIn` props from §4.
- `src/lib/homeContentSeed.ts` and `scripts/seed-home-content.mjs` (duplicate arrays, existing
  pattern): the `creative-design-studio` category's "Pro Resume Maker" item gets
  `href: "/tools/pro-resume-maker"` (currently `null`, rendering as a disabled "Coming soon"
  card).
- `src/messages/en.json`, `hin.json`, `pun.json`: add a `tools["pro-resume-maker"]` entry
  (`name`/`description`), matching every other tool's translation shape.

## Data flow summary

Admin seeds/manages templates via `/admin/templates` → public `GET /api/templates` lists active
ones for a `toolSlug` → user visits `/tools/pro-resume-maker` → page checks Pro status
server-side → non-Pro sees the gate modal; Pro sees `TemplatePicker` → picks a template →
fills the resume form → `generateResumePdf(data, layoutKey)` builds a styled PDF client-side →
downloads.

## Error handling

- Admin template routes: same guard/validation/error-shape convention as Portal Links/FAQs
  (`requireAdminApi()` 401, zod `safeParse` 400, 404 on missing id).
- Public `GET /api/templates`: returns `[]` (not an error) if `toolSlug` is missing or has no
  active templates — the picker shows an empty state rather than erroring.
- The Pro gate reads `User.isPro` fresh from the DB on every page load, not the JWT claim (same
  rule as `/pro`), so a just-revoked Pro user is correctly gated on their very next visit.

## Testing

No test framework exists in this repo. Verification is manual: `npx tsc --noEmit` and `npm run
build` after each task, plus exercising the admin CRUD, the public API, the Pro gate (as a
logged-out user, a logged-in non-Pro user, and a Pro user), and generating at least one PDF per
template layout (checking the 2-column sidebar template across a multi-page resume) against the
real dev server and database.
