# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate, non-localized `/admin` panel (own login, own auth provider, own layout) that lets the site owner manage `User` accounts, view/search `Visitor` traffic (never including the admin's own activity), manage homepage portal-link service cards (with real external URLs), and manage FAQs — plus fix the `test`/`toolnest` MongoDB database split.

**Architecture:** A second NextAuth `Credentials` provider (`id: "admin-login"`) backed by a new, separate `Admin` collection, carrying a `role` claim through the JWT/session. Admin pages live at `src/app/admin/**`, a sibling of `src/app/[locale]/**` (no i18n), gated by a shared `requireAdmin*` helper. `src/proxy.ts` excludes `/admin` from its matcher and skips visitor tracking whenever the session role is `admin`. CRUD features follow this repo's existing convention: server-component pages do the initial DB read, client components call `/api/admin/**` route handlers (zod-validated, mongoose) for mutations.

**Tech Stack:** Next.js 16 App Router, NextAuth v5 (beta), Mongoose, zod, Tailwind (existing `brand-*` utility classes). No test framework exists in this repo — every task's verification step is a concrete manual check (dev server + curl/browser + exact expected output), not an automated test.

**Spec:** `docs/superpowers/specs/2026-09-24-admin-panel-design.md`

## Global Constraints

- Admin is a fully separate identity from `User` — never a role flag on the existing `User` collection.
- Admin pages/routes are **not** locale-prefixed (`src/app/admin/**`, not `src/app/[locale]/admin/**`).
- The admin's own activity must never create/update a `Visitor` document, anywhere on the site, not just under `/admin`.
- All `MONGODB_URI` connections that don't already pass an explicit `dbName` must be fixed to target `toolnest`, never fall through to `test`.
- No new dependencies — everything needed (`bcryptjs`, `zod`, `mongoose`, `next-auth`) is already installed.
- `npx tsc --noEmit` and `npm run build` (fresh `.next`) must pass after every task before committing.

## Review Focus

- Unauthenticated (or non-admin) requests to any `/admin/**` page or `/api/admin/**` route must be rejected (redirect/401), not merely hidden in the UI — Task 2/4/5/6/7 steps verify this directly with no session cookie.
- An admin browsing the public `/[locale]/**` site (not just `/admin`) must never produce a new/updated `Visitor` document — Task 3 verifies this explicitly, comparing visitor state before/after.
- Adding the second `Credentials` provider must not break the existing regular-user `/login` flow — Task 1/2 verify the original provider (`id: "credentials"`) still authenticates a `User`.
- Portal-link cards with neither `externalUrl` nor `href` must still render as the existing disabled "Coming soon" card, and `externalUrl` links must open with `rel="noopener noreferrer"` — Task 6 verifies all three render states.
- The migration script must never overwrite an existing `toolnest` document on a conflicting `_id` — Task 8 verifies this with a deliberately conflicting document before running against real data.

---

### Task 1: Admin data & auth foundation

**Files:**
- Create: `src/models/Admin.ts`
- Create: `scripts/seed-admin.mjs`
- Modify: `src/auth.ts`
- Modify: `src/types/next-auth.d.ts`
- Create: `src/lib/requireAdmin.ts`
- Modify: `package.json` (add `seed:admin` script)
- Modify: `.env.local.example` (document `ADMIN_NAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD` as seed-time-only vars)

**Interfaces:**
- Produces: `Admin` model (`{ _id, name, email, passwordHash }`), `requireAdminPage(): Promise<Session>` (redirects to `/admin/login` if not admin), `requireAdminApi(): Promise<NextResponse | null>` (returns a 401 response or `null` if authorized). `Session.user.role: "user" | "admin"` available everywhere `auth()` is called, including `src/proxy.ts`.

- [ ] **Step 1: Create the `Admin` model**

`src/models/Admin.ts`:
```ts
import { Schema, model, models } from "mongoose";

export interface AdminDoc {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
}

const AdminSchema = new Schema<AdminDoc>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const Admin = models.Admin || model<AdminDoc>("Admin", AdminSchema);
export default Admin;
```

- [ ] **Step 2: Create the admin seed script**

`scripts/seed-admin.mjs`:
```js
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/toolnest";
const MONGODB_DB = process.env.MONGODB_DB || "toolnest";
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script.");
  process.exit(1);
}

const AdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

async function seed() {
  console.log(`Connecting to database "${MONGODB_DB}" ...`);
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
  const AdminModel = mongoose.models.Admin || mongoose.model("Admin", AdminSchema);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await AdminModel.findOneAndUpdate(
    { email: ADMIN_EMAIL.toLowerCase() },
    { $set: { name: ADMIN_NAME, email: ADMIN_EMAIL.toLowerCase(), passwordHash } },
    { upsert: true }
  );

  console.log(`Admin account ready: ${ADMIN_EMAIL}`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Admin seed failed:", err);
  process.exit(1);
});
```

Add to `package.json` `"scripts"`: `"seed:admin": "node scripts/seed-admin.mjs"`.

Add to `.env.local.example` (comment only, these are passed at seed-run-time, not stored):
```
# Used only when running `npm run seed:admin` — not read by the app itself.
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme
```

- [ ] **Step 3: Add the admin-login provider and role claim to `src/auth.ts`**

Replace the full file with:
```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Admin from "@/models/Admin";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/",
  },
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        await connectToDatabase();
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user._id.toString(), name: user.name, email: user.email };
      },
    }),
    Credentials({
      id: "admin-login",
      name: "Admin Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        await connectToDatabase();
        const admin = await Admin.findOne({ email: email.toLowerCase() });
        if (!admin) return null;

        const valid = await bcrypt.compare(password, admin.passwordHash);
        if (!valid) return null;

        return { id: admin._id.toString(), name: admin.name, email: admin.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = account?.provider === "admin-login" ? "admin" : "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "user" | "admin") ?? "user";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});
```

- [ ] **Step 4: Extend the session type**

`src/types/next-auth.d.ts`:
```ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "user" | "admin";
    } & DefaultSession["user"];
  }
}
```

- [ ] **Step 5: Create the admin guard helpers**

`src/lib/requireAdmin.ts`:
```ts
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireAdminPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    redirect("/admin/login");
  }
  return session;
}

export async function requireAdminApi(): Promise<NextResponse | null> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Seed the real admin account**

Ask the user for the admin email/password to use if not already provided — do not invent a production password. Then run (values supplied at invocation time, not committed anywhere):

Run: `ADMIN_EMAIL=<their email> ADMIN_PASSWORD=<their password> npm run seed:admin`
Expected: `Admin account ready: <their email>` printed, script exits 0.

- [ ] **Step 8: Verify the regular user login provider still works (regression)**

Run the dev server (`npm run dev`), open `/en/login` in the browser, sign in with an existing test `User` account (or sign up a throwaway one via `/en/signup` first). Confirm it still redirects to `/` successfully — the new `admin-login` provider must not interfere with the default `credentials` provider.

- [ ] **Step 9: Commit**

```bash
git add src/models/Admin.ts scripts/seed-admin.mjs src/auth.ts src/types/next-auth.d.ts src/lib/requireAdmin.ts package.json .env.local.example
git commit -m "Add admin identity, auth provider, and role-based session claim"
```

---

### Task 2: Admin shell & login flow

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/components/admin/AdminShell.tsx`
- Create: `src/app/admin/login/page.tsx`
- Create: `src/components/admin/AdminLoginForm.tsx`
- Create: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `requireAdminPage()` from `src/lib/requireAdmin.ts` (Task 1), NextAuth's `signIn("admin-login", …)` / `signOut()`.
- Produces: `AdminShell({ adminName: string, children: React.ReactNode })` — every later admin page (Tasks 4–7) wraps its content in this component for consistent nav/logout chrome.

- [ ] **Step 1: Admin root layout**

`src/app/admin/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { SessionProvider } from "@/components/SessionProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import "../globals.css";

export const metadata: Metadata = {
  title: "Admin · PrintBro",
  description: "Internal admin panel.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased flex min-h-screen flex-col bg-background text-foreground">
        <ThemeProvider>
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Admin shell (sidebar + logout)**

`src/components/admin/AdminShell.tsx`:
```tsx
"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/visitors", label: "Visitors" },
  { href: "/admin/portal-links", label: "Portal Links" },
  { href: "/admin/faqs", label: "FAQs" },
];

export default function AdminShell({
  adminName,
  children,
}: {
  adminName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-surface px-4 py-6 sm:block">
        <p className="mb-6 font-heading text-sm font-bold text-foreground">PrintBro Admin</p>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-soft"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <span className="text-sm text-muted">Signed in as {adminName}</span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft"
          >
            Log out
          </button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Admin login page + form**

`src/app/admin/login/page.tsx`:
```tsx
import AdminLoginForm from "@/components/admin/AdminLoginForm";

export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
```

`src/components/admin/AdminLoginForm.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("admin-login", { email, password, redirect: false });
    if (result?.error) {
      setError("Invalid admin email or password.");
      setLoading(false);
      return;
    }

    router.push("/admin");
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-10">
      <div className="brand-card w-full max-w-sm p-8">
        <h1 className="text-center font-heading text-lg font-bold text-foreground">Admin Login</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin email"
            className="brand-input w-full px-4 py-3 text-sm"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="brand-input w-full px-4 py-3 text-sm"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="brand-pill-btn w-full py-3 text-sm disabled:opacity-70"
          >
            {loading ? "..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Admin dashboard**

`src/app/admin/page.tsx`:
```tsx
import Link from "next/link";
import { requireAdminPage } from "@/lib/requireAdmin";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">Dashboard</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminNavCard href="/admin/users" title="Users" description="View, edit, and remove registered users." />
        <AdminNavCard href="/admin/visitors" title="Visitors" description="Search visitor traffic tracked by IP." />
        <AdminNavCard href="/admin/portal-links" title="Portal Links" description="Manage homepage service/portal cards." />
        <AdminNavCard href="/admin/faqs" title="FAQs" description="Manage the homepage FAQ list." />
      </div>
    </AdminShell>
  );
}

function AdminNavCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="brand-card block p-5 transition hover:-translate-y-1">
      <h2 className="font-heading text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </Link>
  );
}
```

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 6: Manual verification**

Start `npm run dev`. In a browser:
1. Visit `/admin` with no session — confirm redirect to `/admin/login`.
2. Log in at `/admin/login` with the seeded admin credentials — confirm redirect to `/admin` showing the dashboard with four nav cards and "Signed in as <name>".
3. Click "Log out" — confirm redirect to `/admin/login`.
4. Visit `/admin/login` directly while logged in as a regular `User` (from Task 1 Step 8) — confirm the admin form is separate and does not accept the user's credentials (wrong provider), and that visiting `/admin` while only a regular-user session is active still redirects to `/admin/login` (role check, not just "any session").

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/layout.tsx src/components/admin/AdminShell.tsx src/app/admin/login/page.tsx src/components/admin/AdminLoginForm.tsx src/app/admin/page.tsx
git commit -m "Add admin shell, login page, and dashboard"
```

---

### Task 3: Proxy — exclude admin routes and never track admin visits

**Files:**
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: `request.auth?.user?.role` (Task 1's session shape), existing `recordVisit`/`getClientIp` from the visitor-tracking feature.

- [ ] **Step 1: Update the matcher and skip tracking for admin sessions**

Replace `src/proxy.ts` with:
```ts
import type { NextFetchEvent } from "next/server";
import type { NextAuthRequest } from "next-auth";
import createMiddleware from "next-intl/middleware";
import { routing, locales } from "./i18n/routing";
import { auth } from "./auth";
import { getClientIp } from "./lib/getClientIp";
import { recordVisit } from "./lib/trackVisit";

const intlMiddleware = createMiddleware(routing);

export default auth((request: NextAuthRequest, event: NextFetchEvent) => {
  const response = intlMiddleware(request);

  if (request.auth?.user?.role !== "admin") {
    const pathname = request.nextUrl.pathname;
    const firstSegment = pathname.split("/")[1];
    const locale = (locales as readonly string[]).includes(firstSegment) ? firstSegment : undefined;

    event.waitUntil(
      recordVisit(getClientIp(request), {
        path: pathname,
        locale,
        userId: request.auth?.user?.id,
        email: request.auth?.user?.email ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
        referer: request.headers.get("referer") ?? undefined,
      })
    );
  }

  return response;
});

export const config = {
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify `/admin` is excluded from locale routing**

Start `npm run dev`. Run: `curl -s -o /dev/null -w "%{http_code} %{url_effective}\n" http://localhost:3002/admin`
Expected: the request is served directly (no redirect to `/en/admin`) — a 200 or 307-to-`/admin/login` response, never a redirect adding a locale prefix.

- [ ] **Step 4: Verify admin sessions never create Visitor documents**

With the dev server running and connected to the real `toolnest` database:
1. Note the current visitor document count for your test IP (or use a distinguishing `curl -H "X-Forwarded-For: 198.51.100.7"`).
2. Log in as admin in the browser, then visit a public page (`/en`) while that admin session's cookie is active.
3. Query MongoDB (small throwaway node script under `scripts/`, same pattern used for the original visitor-tracking feature verification — connect via `mongoose`, read `.env.local`, query `visitors` collection, then delete the script) to confirm no new `Visitor` document was created/updated for the admin's IP during that visit.
4. As a control, repeat with a logged-out browser/incognito window hitting `/en` — confirm a `Visitor` document IS created for that request, proving tracking still works for non-admins.
5. Delete any test documents created during verification (same cleanup approach as the original tracking feature).

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts
git commit -m "Exclude admin routes from proxy and skip visitor tracking for admin sessions"
```

---

### Task 4: Users management

**Files:**
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/[id]/route.ts`
- Create: `src/app/admin/users/page.tsx`
- Create: `src/components/admin/UsersTable.tsx`

**Interfaces:**
- Consumes: `requireAdminApi()`, `requireAdminPage()` (Task 1), `AdminShell` (Task 2), existing `User` model.
- Produces: `GET /api/admin/users` → `{ id, name, email, recentToolsCount }[]`. `PATCH /api/admin/users/:id` body `{ name?, email? }` → `{ id, name, email }`. `DELETE /api/admin/users/:id` → `{ success: true }`.

- [ ] **Step 1: List route**

`src/app/api/admin/users/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

export async function GET() {
  const guard = await requireAdminApi();
  if (guard) return guard;

  await connectToDatabase();
  const users = await User.find().sort({ createdAt: -1 }).lean();

  return NextResponse.json(
    users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      recentToolsCount: user.recentTools?.length ?? 0,
    }))
  );
}
```

- [ ] **Step 2: Detail/update/delete route**

`src/app/api/admin/users/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid name or email." }, { status: 400 });
  }

  await connectToDatabase();
  const update: Record<string, string> = {};
  if (parsed.data.name) update.name = parsed.data.name;
  if (parsed.data.email) update.email = parsed.data.email.toLowerCase();

  const user = await User.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ id: user._id.toString(), name: user.name, email: user.email });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  await connectToDatabase();
  const result = await User.findByIdAndDelete(id);
  if (!result) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Admin users page**

`src/app/admin/users/page.tsx`:
```tsx
import { requireAdminPage } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import AdminShell from "@/components/admin/AdminShell";
import UsersTable from "@/components/admin/UsersTable";

export default async function AdminUsersPage() {
  const session = await requireAdminPage();

  await connectToDatabase();
  const users = await User.find().sort({ createdAt: -1 }).lean();

  const initialUsers = users.map((user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    recentToolsCount: user.recentTools?.length ?? 0,
  }));

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">Users</h1>
      <p className="mt-1 text-sm text-muted">{initialUsers.length} registered users.</p>
      <UsersTable initialUsers={initialUsers} />
    </AdminShell>
  );
}
```

- [ ] **Step 4: Users table client component**

`src/components/admin/UsersTable.tsx`:
```tsx
"use client";

import { useState } from "react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  recentToolsCount: number;
}

export default function UsersTable({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function startEdit(user: AdminUser) {
    setEditingId(user.id);
    setDraftName(user.name);
    setDraftEmail(user.email);
    setError(null);
  }

  async function saveEdit(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draftName, email: draftEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to update user.");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, name: data.name, email: data.email } : u)));
    setEditingId(null);
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete user.");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="mt-6 overflow-x-auto">
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Recent tools</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-border">
              <td className="py-2 pr-4">
                {editingId === user.id ? (
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="brand-input px-2 py-1 text-sm"
                  />
                ) : (
                  user.name
                )}
              </td>
              <td className="py-2 pr-4">
                {editingId === user.id ? (
                  <input
                    value={draftEmail}
                    onChange={(e) => setDraftEmail(e.target.value)}
                    className="brand-input px-2 py-1 text-sm"
                  />
                ) : (
                  user.email
                )}
              </td>
              <td className="py-2 pr-4">{user.recentToolsCount}</td>
              <td className="py-2 pr-4">
                {editingId === user.id ? (
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(user.id)} className="text-brand-bright hover:underline">
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-muted hover:underline">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(user)} className="text-brand-bright hover:underline">
                      Edit
                    </button>
                    <button onClick={() => deleteUser(user.id)} className="text-danger hover:underline">
                      Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-muted">
                No users yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 6: Manual verification**

1. `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/api/admin/users` with no cookies — expect `401`.
2. Log in as admin in the browser, visit `/admin/users` — confirm the table lists all real `User` documents.
3. Edit a test user's name, save, confirm it updates in the table and in MongoDB.
4. Delete a throwaway test user (create one via `/en/signup` first if needed) and confirm it disappears from the table and MongoDB. Do not delete any real user accounts you care about.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/users src/app/admin/users src/components/admin/UsersTable.tsx
git commit -m "Add admin user management (list, edit, delete)"
```

---

### Task 5: Visitors management (read-only)

**Files:**
- Create: `src/app/api/admin/visitors/route.ts`
- Create: `src/app/admin/visitors/page.tsx`
- Create: `src/components/admin/VisitorsBrowser.tsx`

**Interfaces:**
- Consumes: `requireAdminApi()`, `requireAdminPage()` (Task 1), `AdminShell` (Task 2), existing `Visitor` model.
- Produces: `GET /api/admin/visitors?q=<term>` → `{ id, ip, visitCount, firstSeenAt, lastSeenAt, actions }[]` (most recent 200 visitors, `actions` limited to their most recent 20).

- [ ] **Step 1: List/search route**

`src/app/api/admin/visitors/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Visitor from "@/models/Visitor";

export async function GET(request: Request) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  await connectToDatabase();
  const filter = q
    ? { $or: [{ ip: { $regex: q, $options: "i" } }, { "actions.path": { $regex: q, $options: "i" } }] }
    : {};

  const visitors = await Visitor.find(filter).sort({ lastSeenAt: -1 }).limit(200).lean();

  return NextResponse.json(
    visitors.map((visitor) => ({
      id: visitor._id.toString(),
      ip: visitor.ip,
      visitCount: visitor.visitCount,
      firstSeenAt: visitor.firstSeenAt,
      lastSeenAt: visitor.lastSeenAt,
      actions: visitor.actions.slice(-20).reverse(),
    }))
  );
}
```

- [ ] **Step 2: Admin visitors page**

`src/app/admin/visitors/page.tsx`:
```tsx
import { requireAdminPage } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Visitor from "@/models/Visitor";
import AdminShell from "@/components/admin/AdminShell";
import VisitorsBrowser from "@/components/admin/VisitorsBrowser";

export default async function AdminVisitorsPage() {
  const session = await requireAdminPage();

  await connectToDatabase();
  const visitors = await Visitor.find().sort({ lastSeenAt: -1 }).limit(200).lean();

  const initialVisitors = visitors.map((visitor) => ({
    id: visitor._id.toString(),
    ip: visitor.ip,
    visitCount: visitor.visitCount,
    firstSeenAt: visitor.firstSeenAt.toISOString(),
    lastSeenAt: visitor.lastSeenAt.toISOString(),
    actions: visitor.actions
      .slice(-20)
      .reverse()
      .map((a) => ({ ...a, at: a.at.toISOString() })),
  }));

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">Visitors</h1>
      <p className="mt-1 text-sm text-muted">{initialVisitors.length} tracked IPs (most recent 200).</p>
      <VisitorsBrowser initialVisitors={initialVisitors} />
    </AdminShell>
  );
}
```

- [ ] **Step 3: Visitors browser client component**

`src/components/admin/VisitorsBrowser.tsx`:
```tsx
"use client";

import { useState } from "react";

interface VisitorAction {
  path: string;
  locale?: string;
  userId?: string;
  email?: string;
  userAgent?: string;
  referer?: string;
  at: string;
}

interface AdminVisitor {
  id: string;
  ip: string;
  visitCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  actions: VisitorAction[];
}

export default function VisitorsBrowser({ initialVisitors }: { initialVisitors: AdminVisitor[] }) {
  const [visitors, setVisitors] = useState(initialVisitors);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function runSearch(q: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/visitors?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setVisitors(data);
    setLoading(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  return (
    <div className="mt-6">
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by IP or path..."
          className="brand-input flex-1 px-4 py-2 text-sm"
        />
        <button type="submit" className="brand-pill-btn px-4 py-2 text-sm">
          {loading ? "..." : "Search"}
        </button>
      </form>

      <div className="space-y-2">
        {visitors.map((visitor) => (
          <div key={visitor.id} className="brand-card p-4">
            <button
              type="button"
              onClick={() => setExpandedId((id) => (id === visitor.id ? null : visitor.id))}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <p className="font-medium text-foreground">{visitor.ip}</p>
                <p className="text-xs text-muted">
                  {visitor.visitCount} visits · last seen {new Date(visitor.lastSeenAt).toLocaleString()}
                </p>
              </div>
              <span className="text-xs text-muted">{expandedId === visitor.id ? "Hide" : "View"} actions</span>
            </button>

            {expandedId === visitor.id && (
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted">
                {visitor.actions.map((action, i) => (
                  <li key={i}>
                    <span className="text-foreground">{action.path}</span>{" "}
                    {action.email && <span>· {action.email}</span>} <span>· {new Date(action.at).toLocaleString()}</span>
                  </li>
                ))}
                {visitor.actions.length === 0 && <li>No recorded actions.</li>}
              </ul>
            )}
          </div>
        ))}
        {visitors.length === 0 && <p className="text-sm text-muted">No visitors found.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 5: Manual verification**

1. `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/api/admin/visitors` with no cookies — expect `401`.
2. Visit `/admin/visitors` as admin — confirm real visitor IPs and their action counts show up, and that no delete/edit controls exist (read-only).
3. Type an IP substring or a path (e.g. `/en`) into the search box, confirm the list filters correctly.
4. Click a visitor row, confirm its recent actions (path, timestamp, email if present) expand below it.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/visitors src/app/admin/visitors src/components/admin/VisitorsBrowser.tsx
git commit -m "Add read-only admin visitor browser with search"
```

---

### Task 6: Portal links (external URLs on `Service`)

**Files:**
- Modify: `src/models/Service.ts`
- Modify: `src/lib/getHomeContent.ts`
- Modify: `src/components/ServiceCard.tsx`
- Modify: `src/components/CategorySection.tsx`
- Create: `src/app/api/admin/portal-links/route.ts`
- Create: `src/app/api/admin/portal-links/[id]/route.ts`
- Create: `src/app/admin/portal-links/page.tsx`
- Create: `src/components/admin/PortalLinksManager.tsx`

**Interfaces:**
- Consumes: `requireAdminApi()`, `requireAdminPage()` (Task 1), `AdminShell` (Task 2), existing `Service`/`Category` models.
- Produces: `Service.externalUrl: string | null`. `ServiceView.externalUrl: string | null` (public homepage data). `GET/POST /api/admin/portal-links`, `PATCH/DELETE /api/admin/portal-links/:id`.

- [ ] **Step 1: Add `externalUrl` to the `Service` model**

In `src/models/Service.ts`, add the field to both the interface and schema:
```ts
export interface ServiceDoc {
  _id: string;
  slug: string;
  categorySlug: string;
  title: string;
  badge: ServiceBadge;
  href: string | null;
  externalUrl: string | null;
  order: number;
  active: boolean;
}
```
And in `ServiceSchema`, add after `href`:
```ts
    externalUrl: { type: String, default: null },
```

- [ ] **Step 2: Thread `externalUrl` through `getHomeContent`**

In `src/lib/getHomeContent.ts`:
- Add `externalUrl: string | null;` to `ServiceView`.
- In `staticFallback()`, add `externalUrl: null,` to each mapped item.
- In the DB-backed `categoryViews` mapping, add `externalUrl: service.externalUrl ?? null,` alongside the existing `href: service.href,` line.

- [ ] **Step 3: Render external links in `ServiceCard`**

Replace `src/components/ServiceCard.tsx`:
```tsx
import { Link } from "@/i18n/navigation";
import ServiceBadge from "./ServiceBadge";

interface ServiceCardProps {
  title: string;
  badge: "NEW" | "HOT" | null;
  href: string | null;
  externalUrl: string | null;
  icon: React.ReactNode;
}

export default function ServiceCard({ title, badge, href, externalUrl, icon }: ServiceCardProps) {
  const content = (
    <>
      <ServiceBadge badge={badge} />
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-soft transition-transform duration-200 group-hover:scale-110">
        {icon}
      </span>
      <h3 className="font-heading text-sm font-semibold text-foreground">{title}</h3>
    </>
  );

  const cardClass =
    "brand-card group relative flex flex-col items-start gap-3 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-brand-light hover:shadow-[0_12px_24px_-12px_var(--color-brand)]";

  if (externalUrl) {
    return (
      <a href={externalUrl} target="_blank" rel="noopener noreferrer" className={cardClass}>
        {content}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} className={cardClass}>
        {content}
      </Link>
    );
  }

  return (
    <div
      title="Coming soon"
      className="brand-card relative flex cursor-default flex-col items-start gap-3 p-4 opacity-70"
    >
      {content}
    </div>
  );
}
```

- [ ] **Step 4: Pass `externalUrl` through `CategorySection`**

In `src/components/CategorySection.tsx`, update the `ServiceCard` usage:
```tsx
          <ServiceCard
            key={item.slug}
            title={item.title}
            badge={item.badge}
            href={item.href}
            externalUrl={item.externalUrl}
            icon={resolveIcon(category.slug, item.href)}
          />
```

- [ ] **Step 5: Portal links list/create route**

`src/app/api/admin/portal-links/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Service from "@/models/Service";

const createSchema = z.object({
  slug: z.string().min(1).max(80),
  categorySlug: z.string().min(1),
  title: z.string().min(1).max(120),
  externalUrl: z.string().url().nullable().optional(),
});

export async function GET() {
  const guard = await requireAdminApi();
  if (guard) return guard;

  await connectToDatabase();
  const services = await Service.find().sort({ categorySlug: 1, order: 1 }).lean();

  return NextResponse.json(
    services.map((s) => ({
      id: s._id.toString(),
      slug: s.slug,
      categorySlug: s.categorySlug,
      title: s.title,
      badge: s.badge,
      href: s.href,
      externalUrl: s.externalUrl ?? null,
      order: s.order,
      active: s.active,
    }))
  );
}

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid portal link data." }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await Service.findOne({ slug: parsed.data.slug });
  if (existing) {
    return NextResponse.json({ error: "A service with this slug already exists." }, { status: 409 });
  }

  const service = await Service.create({
    slug: parsed.data.slug,
    categorySlug: parsed.data.categorySlug,
    title: parsed.data.title,
    externalUrl: parsed.data.externalUrl ?? null,
    badge: null,
    href: null,
    order: 0,
    active: true,
  });

  return NextResponse.json({ id: service._id.toString() }, { status: 201 });
}
```

- [ ] **Step 6: Portal link update/delete route**

`src/app/api/admin/portal-links/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Service from "@/models/Service";

const updateSchema = z.object({
  categorySlug: z.string().min(1).optional(),
  title: z.string().min(1).max(120).optional(),
  externalUrl: z.string().url().nullable().optional(),
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
    return NextResponse.json({ error: "Invalid portal link data." }, { status: 400 });
  }

  await connectToDatabase();
  const service = await Service.findByIdAndUpdate(id, { $set: parsed.data }, { new: true }).lean();
  if (!service) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  return NextResponse.json({ id: service._id.toString() });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  await connectToDatabase();
  const result = await Service.findByIdAndDelete(id);
  if (!result) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 7: Admin portal-links page**

`src/app/admin/portal-links/page.tsx`:
```tsx
import { requireAdminPage } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Service from "@/models/Service";
import Category from "@/models/Category";
import AdminShell from "@/components/admin/AdminShell";
import PortalLinksManager from "@/components/admin/PortalLinksManager";

export default async function AdminPortalLinksPage() {
  const session = await requireAdminPage();

  await connectToDatabase();
  const [services, categories] = await Promise.all([
    Service.find().sort({ categorySlug: 1, order: 1 }).lean(),
    Category.find().sort({ order: 1 }).lean(),
  ]);

  const initialServices = services.map((s) => ({
    id: s._id.toString(),
    slug: s.slug,
    categorySlug: s.categorySlug,
    title: s.title,
    href: s.href,
    externalUrl: s.externalUrl ?? null,
    active: s.active,
  }));

  const categoryOptions = categories.map((c) => ({ slug: c.slug, title: c.title }));

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">Portal Links</h1>
      <p className="mt-1 text-sm text-muted">
        Manage the homepage service cards. Set an external URL to make a &quot;Coming soon&quot; card a real link.
      </p>
      <PortalLinksManager initialServices={initialServices} categoryOptions={categoryOptions} />
    </AdminShell>
  );
}
```

- [ ] **Step 8: Portal links manager client component**

`src/components/admin/PortalLinksManager.tsx`:
```tsx
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
```

- [ ] **Step 9: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 10: Manual verification**

1. `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/api/admin/portal-links` with no cookies — expect `401`.
2. Visit `/admin/portal-links` as admin. Pick an existing "Coming soon" service, click "Edit URL", set it to `https://example.com`, save.
3. Visit the public homepage (`/en`) and confirm that card is now a real clickable link opening `https://example.com` in a new tab.
4. Create a brand-new portal link via the form, confirm it appears both in the admin table and on the public homepage under the chosen category.
5. Deactivate it, confirm it disappears from the public homepage (still `active: false` in DB) but remains visible in the admin table.
6. Confirm a service with no `externalUrl` and no `href` still renders as the disabled "Coming soon" card, and one with only an internal `href` (e.g. `/tools/merge-pdf`) still works via the i18n `Link` as before.

- [ ] **Step 11: Commit**

```bash
git add src/models/Service.ts src/lib/getHomeContent.ts src/components/ServiceCard.tsx src/components/CategorySection.tsx src/app/api/admin/portal-links src/app/admin/portal-links src/components/admin/PortalLinksManager.tsx
git commit -m "Add external URL support and admin management for portal-link services"
```

---

### Task 7: FAQs management

**Files:**
- Create: `src/app/api/admin/faqs/route.ts`
- Create: `src/app/api/admin/faqs/[id]/route.ts`
- Create: `src/app/admin/faqs/page.tsx`
- Create: `src/components/admin/FaqsManager.tsx`

**Interfaces:**
- Consumes: `requireAdminApi()`, `requireAdminPage()` (Task 1), `AdminShell` (Task 2), existing `Faq` model.
- Produces: `GET/POST /api/admin/faqs`, `PATCH/DELETE /api/admin/faqs/:id`.

- [ ] **Step 1: List/create route**

`src/app/api/admin/faqs/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Faq from "@/models/Faq";

const createSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(2000),
});

export async function GET() {
  const guard = await requireAdminApi();
  if (guard) return guard;

  await connectToDatabase();
  const faqs = await Faq.find().sort({ order: 1 }).lean();

  return NextResponse.json(
    faqs.map((f) => ({
      id: f._id.toString(),
      question: f.question,
      answer: f.answer,
      order: f.order,
      active: f.active,
    }))
  );
}

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid FAQ data." }, { status: 400 });
  }

  await connectToDatabase();
  const count = await Faq.countDocuments();
  const faq = await Faq.create({ ...parsed.data, order: count });

  return NextResponse.json({ id: faq._id.toString() }, { status: 201 });
}
```

- [ ] **Step 2: Update/delete route**

`src/app/api/admin/faqs/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Faq from "@/models/Faq";

const updateSchema = z.object({
  question: z.string().min(1).max(300).optional(),
  answer: z.string().min(1).max(2000).optional(),
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
    return NextResponse.json({ error: "Invalid FAQ data." }, { status: 400 });
  }

  await connectToDatabase();
  const faq = await Faq.findByIdAndUpdate(id, { $set: parsed.data }, { new: true }).lean();
  if (!faq) {
    return NextResponse.json({ error: "FAQ not found." }, { status: 404 });
  }

  return NextResponse.json({ id: faq._id.toString() });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  await connectToDatabase();
  const result = await Faq.findByIdAndDelete(id);
  if (!result) {
    return NextResponse.json({ error: "FAQ not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Admin FAQs page**

`src/app/admin/faqs/page.tsx`:
```tsx
import { requireAdminPage } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Faq from "@/models/Faq";
import AdminShell from "@/components/admin/AdminShell";
import FaqsManager from "@/components/admin/FaqsManager";

export default async function AdminFaqsPage() {
  const session = await requireAdminPage();

  await connectToDatabase();
  const faqs = await Faq.find().sort({ order: 1 }).lean();

  const initialFaqs = faqs.map((f) => ({
    id: f._id.toString(),
    question: f.question,
    answer: f.answer,
    active: f.active,
  }));

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">FAQs</h1>
      <FaqsManager initialFaqs={initialFaqs} />
    </AdminShell>
  );
}
```

- [ ] **Step 4: FAQs manager client component**

`src/components/admin/FaqsManager.tsx`:
```tsx
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
```

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 6: Manual verification**

1. `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/api/admin/faqs` with no cookies — expect `401`.
2. Visit `/admin/faqs` as admin. Add a throwaway FAQ, confirm it appears in the list and on the public homepage's FAQ accordion (`/en`, scroll to FAQ section).
3. Edit it, confirm the change reflects on the homepage after refresh.
4. Deactivate it, confirm it disappears from the public homepage but stays in the admin list.
5. Delete it, confirm it's gone from both.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/faqs src/app/admin/faqs src/components/admin/FaqsManager.tsx
git commit -m "Add admin FAQ management"
```

---

### Task 8: Database targeting fix + test→toolnest migration

**Files:**
- Modify: `scripts/seed-tools.mjs`
- Modify: `scripts/seed-home-content.mjs`
- Create: `scripts/migrate-test-to-toolnest.mjs`

**Interfaces:**
- Produces: `npm run migrate:toolnest` (new `package.json` script).

- [ ] **Step 1: Pin `dbName` in both seed scripts**

In `scripts/seed-tools.mjs`, change:
```js
  await mongoose.connect(MONGODB_URI);
```
to:
```js
  await mongoose.connect(MONGODB_URI, { dbName: "toolnest" });
```

In `scripts/seed-home-content.mjs`, make the identical change at its `mongoose.connect(MONGODB_URI);` call (line 171).

- [ ] **Step 2: Write the migration script**

`scripts/migrate-test-to-toolnest.mjs`:
```js
import { existsSync } from "node:fs";
import mongoose from "mongoose";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/toolnest";
const SOURCE_DB = "test";
const TARGET_DB = "toolnest";
const DROP_SOURCE = process.argv.includes("--drop-source");

async function migrate() {
  console.log(`Connecting to ${MONGODB_URI} ...`);
  await mongoose.connect(MONGODB_URI);
  const client = mongoose.connection.getClient();
  const sourceDb = client.db(SOURCE_DB);
  const targetDb = client.db(TARGET_DB);

  const collections = await sourceDb.listCollections().toArray();
  if (collections.length === 0) {
    console.log(`No collections found in "${SOURCE_DB}". Nothing to migrate.`);
  }

  for (const { name } of collections) {
    const sourceCollection = sourceDb.collection(name);
    const targetCollection = targetDb.collection(name);

    const docs = await sourceCollection.find().toArray();
    let copied = 0;
    let skipped = 0;

    for (const doc of docs) {
      const exists = await targetCollection.findOne({ _id: doc._id });
      if (exists) {
        skipped += 1;
        continue;
      }
      await targetCollection.insertOne(doc);
      copied += 1;
    }

    console.log(`Collection "${name}": copied ${copied}, skipped ${skipped} (already in ${TARGET_DB}).`);
  }

  if (!DROP_SOURCE) {
    console.log(
      `\nDone. Re-run with --drop-source to drop the "${SOURCE_DB}" database once you've verified "${TARGET_DB}" looks correct.`
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`\nDropping database "${SOURCE_DB}" ...`);
  await sourceDb.dropDatabase();
  console.log(`Dropped "${SOURCE_DB}".`);

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
```

Add to `package.json` `"scripts"`: `"migrate:toolnest": "node scripts/migrate-test-to-toolnest.mjs"`.

- [ ] **Step 3: Verify conflict handling before touching real data**

Using a throwaway node script (same pattern as prior manual DB checks — connect via mongoose, read `.env.local`, then delete the script afterward): insert one document with a fixed `_id` into `test.__migration_check` and a *different* document with the *same* `_id` into `toolnest.__migration_check`. Run `npm run migrate:toolnest` (without `--drop-source`) and confirm the console reports `copied 0, skipped 1` for `__migration_check`, and that `toolnest.__migration_check`'s document is unchanged (proving toolnest wins on conflict). Delete the `__migration_check` collection from both databases afterward.

- [ ] **Step 4: Run the real migration**

Run: `npm run migrate:toolnest`
Expected: a per-collection copied/skipped summary printed for every real collection found in `test`.

Show the user this summary and explicitly confirm they want `test` dropped before proceeding.

Run: `npm run migrate:toolnest -- --drop-source`
Expected: the same summary, followed by `Dropping database "test" ...` and `Dropped "test".`.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-tools.mjs scripts/seed-home-content.mjs scripts/migrate-test-to-toolnest.mjs package.json
git commit -m "Pin seed scripts to toolnest and add test-to-toolnest migration script"
```

---

### Task 9: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full clean build**

Run: `rm -rf .next && npx tsc --noEmit && npm run build`
Expected: all three succeed with zero errors.

- [ ] **Step 2: Lint changed files**

Run: `npx eslint src/app/admin src/app/api/admin src/components/admin src/lib/requireAdmin.ts src/proxy.ts src/auth.ts src/types/next-auth.d.ts src/models/Admin.ts src/models/Service.ts src/lib/getHomeContent.ts src/components/ServiceCard.tsx src/components/CategorySection.tsx`
Expected: no errors.

- [ ] **Step 3: End-to-end walkthrough**

With the dev server running against the real `toolnest` database:
1. Confirm `/admin` redirects to login when logged out, and that regular `/login`/`/signup` for `User` accounts still work unaffected.
2. Log in as admin, walk through Users, Visitors, Portal Links, and FAQs sections once each, confirming every CRUD action from Tasks 4–7 still works together (not just in isolation).
3. Confirm the public homepage renders correctly: existing internal tool links still work, the "Coming soon" cards without a link still show as disabled, and any portal links set to external URLs during testing still open correctly.
4. Confirm no `Visitor` document was created for the admin's IP at any point during this walkthrough (re-check the count against what it was before starting).

- [ ] **Step 4: Final commit (if any cleanup was needed)**

```bash
git status --short
```
If anything is uncommitted from cleanup during verification, commit it with a clear message; otherwise this step is a no-op.
