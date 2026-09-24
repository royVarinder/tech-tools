# Admin Panel — Design Spec

Date: 2026-09-24
Status: Approved

## Purpose

Give the site owner a separate, internal admin area to:
- Manage registered `User` accounts (view, edit, delete).
- View/search visitor traffic (`Visitor` records) read-only.
- Manage homepage "portal link" service cards (`Service`), including setting a real external URL.
- Manage FAQs (`Faq`).

The admin must be a distinct identity from regular `User` accounts (its own login form/route, its own collection), and admin activity must never be recorded as visitor traffic.

Separately, fix a data-hygiene issue: some writes have been landing in a `test` MongoDB database instead of `toolnest` because two seed scripts don't pin a `dbName`. Migrate any data currently in `test` into `toolnest`, then fix the scripts so it can't recur.

## Non-goals

- No UI for creating new *tool* types (`Tool`/`src/components/tools/*`) — those require code, out of scope here.
- No multi-admin management UI — a single admin account, seeded via script.
- No editing/deleting visitor records — view/search only.
- No i18n for the admin UI — English-only, outside `[locale]`.

## Architecture

### 1. Admin identity & auth

- New model `src/models/Admin.ts`: `{ name, email (unique, lowercase), passwordHash }`, timestamps — mirrors `User.ts`'s shape/conventions.
- New script `scripts/seed-admin.mjs`: reads `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME` from env, bcrypt-hashes the password, upserts the one `Admin` doc by email. Connects with explicit `dbName: "toolnest"`.
- `src/auth.ts` gets a second `Credentials` provider, `id: "admin-login"`, whose `authorize()` looks up `Admin` by email and compares bcrypt hash (same pattern as the existing provider, different collection).
- `jwt` callback: when `account` is present (fresh sign-in), set `token.role = account.provider === "admin-login" ? "admin" : "user"`. Persists in the JWT thereafter.
- `session` callback: copy `token.role` onto `session.user.role`.
- `src/types/next-auth.d.ts`: extend `Session.user` with `role: "user" | "admin"`.

### 2. Routing — separate, non-localized

- `src/app/admin/**`, a sibling of `src/app/[locale]/**` (not nested under it) — admin pages are not locale-prefixed.
- `src/app/admin/layout.tsx`: full `<html>/<body>` shell (admin is outside `[locale]/layout.tsx`, so it needs its own), wraps children in `SessionProvider`, renders a sidebar nav (Users / Visitors / Portal Links / FAQs / Logout) only when authenticated as admin.
- `src/app/admin/login/page.tsx`: standalone form (new `AdminLoginForm` client component) calling `signIn("admin-login", { email, password, redirect: false })`, then routing to `/admin` on success.
- `src/lib/requireAdmin.ts`: server-only helper. `requireAdminPage()` calls `auth()`, redirects to `/admin/login` if `session?.user?.role !== "admin"`. `requireAdminApi()` returns the session or a `401 NextResponse.json` for use inside route handlers.
- Every page under `src/app/admin/**` (except `login`) calls `requireAdminPage()` at the top.

### 3. Never tracking the admin as a visitor

- `src/proxy.ts` matcher changes from `["/((?!api|_next|_vercel|.*\\..*).*)"]` to `["/((?!api|admin|_next|_vercel|.*\\..*).*)"]` — `/admin/**` never runs `intlMiddleware` or `recordVisit`.
- Additionally, inside the proxy handler, skip the `recordVisit` call entirely when `request.auth?.user?.role === "admin"` — covers the case where an admin session browses the public `/[locale]/**` pages.

### 4. Feature CRUD

All admin API routes live under `src/app/api/admin/**`, each starting with `const guard = await requireAdminApi(); if (guard) return guard;`.

- **Users** — `src/app/api/admin/users/route.ts` (GET list), `src/app/api/admin/users/[id]/route.ts` (GET one, PATCH name/email, DELETE). Admin page `src/app/admin/users/page.tsx` (server component, lists via direct DB read) + `src/app/admin/users/UsersTable.tsx` (client component for edit/delete actions calling the API routes).
- **Visitors** — `src/app/api/admin/visitors/route.ts` (GET list with optional `?q=` filtering by ip or action path). Admin page `src/app/admin/visitors/page.tsx` + a client search box. Read-only, no mutating routes.
- **Portal links** — `src/models/Service.ts` gains `externalUrl?: string | null`. `src/components/ServiceCard.tsx` (or wherever it renders `href`) updates: if `externalUrl` set → `<a href={externalUrl} target="_blank" rel="noopener noreferrer">`; else existing internal-`href`-or-"Coming soon" behavior, unchanged. `src/app/api/admin/portal-links/route.ts` (GET list, POST create) + `.../[id]/route.ts` (PATCH, DELETE). Admin page with a simple table + create/edit form.
- **FAQs** — `src/app/api/admin/faqs/route.ts` (GET, POST) + `.../[id]/route.ts` (PATCH, DELETE) over the existing `Faq` model. Admin page with table + create/edit form.

### 5. Database targeting fix + migration

- `scripts/seed-tools.mjs` and `scripts/seed-home-content.mjs`: add `dbName: "toolnest"` to their `mongoose.connect(...)` calls (currently missing, the likely source of the `test`/`toolnest` split).
- New `scripts/migrate-test-to-toolnest.mjs`: connects once, gets handles to both the `test` and `toolnest` databases via the native driver, iterates every collection in `test`, and for each document inserts it into the same-named collection in `toolnest` only if that `_id` doesn't already exist there (toolnest wins on conflict). Prints a per-collection summary (copied / skipped counts). After copying, drops the `test` database — this step will be re-confirmed interactively before it actually runs, since it's irreversible against the real Atlas cluster.

## Data flow summary

Admin login → NextAuth `admin-login` provider validates against `Admin` collection → JWT carries `role: "admin"` → `requireAdminPage`/`requireAdminApi` gate every admin page/route → CRUD pages read initial data server-side, mutate via `/api/admin/**` client-side fetches (same pattern as existing `AuthCard` → `/api/auth/signup`).

## Error handling

- `requireAdminApi()` returns `401` JSON for any unauthenticated/non-admin request to `/api/admin/**`.
- `requireAdminPage()` redirects to `/admin/login` for page requests.
- CRUD routes validate input with `zod` (matching existing `signup` route convention) and return `400` with field errors on failure.
- Migration script never throws away data silently — logs every skip, and requires the drop step to be explicitly confirmed at run time.

## Testing

No test framework exists in this repo (confirmed during prior session — no jest/vitest/test files). Verification will be manual: exercise each admin flow (login, CRUD create/edit/delete for each section, visitor search) against the dev server connected to the real `toolnest` Atlas database, plus a manual check that admin sessions never create `Visitor` documents. `npm run build` and `npx tsc --noEmit` must pass before calling this done.
