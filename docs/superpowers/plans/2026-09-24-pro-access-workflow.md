# Pro Access Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in user apply for Pro access via a form, notify every admin by email (Resend) when they do, let an admin approve/reject from a new admin panel section (and revoke Pro from the existing Users page), and document how to become Pro in the homepage FAQ.

**Architecture:** `User` gains `isPro`/`proSince`. A new `ProApplication` collection tracks one application per submission (`pending`/`approved`/`rejected`) so there's an audit trail and re-application is possible after rejection. NextAuth's JWT/session carries `isPro` as a UI hint; the `/pro` page and its API always re-read `User.isPro` from the DB rather than trusting the JWT claim, since Pro status can change after a session's JWT was issued. Admin approval flows follow this repo's existing convention exactly: server-component admin pages do the initial DB read, client table components call `/api/admin/**` route handlers for mutations. Email goes through a new thin `src/lib/mail.ts` wrapper around Resend.

**Tech Stack:** Next.js 16 App Router, NextAuth v5 (beta), Mongoose, zod, next-intl, Tailwind (existing `brand-*` utility classes), Resend (new dependency). No test framework exists in this repo — every task's verification step is a concrete manual check (dev server + curl/browser + exact expected output), not an automated test.

**Spec:** `docs/superpowers/specs/2026-09-24-pro-access-workflow-design.md`

## Global Constraints

- `isPro` lives only on `User`; admin accounts are unaffected.
- `ProApplication` is its own collection, never embedded on `User`.
- The `/pro` page and `POST /api/pro/apply` must read `User.isPro`/`ProApplication` status fresh from the DB on every request — never trust the JWT's `isPro` claim for anything but the Header's cosmetic "Go Pro" link visibility.
- Admin routes/pages under this feature follow the exact `requireAdminApi()`/`requireAdminPage()` guard pattern already used by every other `/admin/**` feature.
- Missing `RESEND_API_KEY` must never break the apply flow — log and no-op instead of throwing.
- `npx tsc --noEmit` and `npm run build` (fresh `.next`) must pass after every task before committing.

## Review Focus

- A user submitting a second application while one is already `pending` must be rejected with a clear error, not create a duplicate row — Task 3 verifies this directly.
- A user who is already `isPro` must not be able to submit a new application (the `/pro` page must show the "already Pro" state, not the form) — Task 4 verifies this.
- Unauthenticated requests to `POST /api/pro/apply` and to any `/api/admin/pro-applications/**` route must be rejected (401), not silently accepted — Task 3/Task 6 verify this with no session cookie.
- Approving an application must flip `User.isPro` to `true` and set `proSince`; rejecting must leave `User.isPro` untouched — Task 6 verifies both outcomes against MongoDB directly.
- Toggling `isPro` off via `/admin/users` (revoke) must actually cut off "Pro member" status shown on `/pro` for that user on their next page load — Task 7 verifies this end-to-end, not just that the DB field flips.

---

### Task 1: Data model & session plumbing

**Files:**
- Modify: `src/models/User.ts`
- Create: `src/models/ProApplication.ts`
- Modify: `src/auth.ts`
- Modify: `src/types/next-auth.d.ts`

**Interfaces:**
- Produces: `User.isPro: boolean`, `User.proSince: Date | null`. `ProApplication` model (`{ _id, userId, name, email, reason, status: "pending"|"approved"|"rejected", decidedBy: string|null, decidedAt: Date|null }`). `Session.user.isPro: boolean` available anywhere `auth()`/`useSession()` is called.

- [ ] **Step 1: Add `isPro`/`proSince` to the `User` model**

Modify `src/models/User.ts`:
```ts
import { Schema, model, models } from "mongoose";

export interface RecentToolEntry {
  slug: string;
  usedAt: Date;
}

export interface UserDoc {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  recentTools: RecentToolEntry[];
  isPro: boolean;
  proSince: Date | null;
}

const RecentToolSchema = new Schema<RecentToolEntry>(
  {
    slug: { type: String, required: true },
    usedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const UserSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    recentTools: { type: [RecentToolSchema], required: true, default: [] },
    isPro: { type: Boolean, required: true, default: false },
    proSince: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = models.User || model<UserDoc>("User", UserSchema);
export default User;
```

- [ ] **Step 2: Create the `ProApplication` model**

`src/models/ProApplication.ts`:
```ts
import { Schema, model, models, Types } from "mongoose";

export type ProApplicationStatus = "pending" | "approved" | "rejected";

export interface ProApplicationDoc {
  _id: string;
  userId: Types.ObjectId;
  name: string;
  email: string;
  reason: string;
  status: ProApplicationStatus;
  decidedBy: string | null;
  decidedAt: Date | null;
}

const ProApplicationSchema = new Schema<ProApplicationDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },
    decidedBy: { type: String, default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const ProApplication =
  models.ProApplication || model<ProApplicationDoc>("ProApplication", ProApplicationSchema);
export default ProApplication;
```

- [ ] **Step 3: Carry `isPro` through the credentials provider, JWT, and session**

Replace `src/auth.ts` with:
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

        return { id: user._id.toString(), name: user.name, email: user.email, isPro: user.isPro };
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
        token.isPro = (user as { isPro?: boolean }).isPro ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "user" | "admin") ?? "user";
        session.user.isPro = (token.isPro as boolean) ?? false;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});
```

- [ ] **Step 4: Extend the NextAuth types**

Replace `src/types/next-auth.d.ts` with:
```ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    isPro?: boolean;
  }
  interface Session {
    user: {
      id: string;
      role: "user" | "admin";
      isPro: boolean;
    } & DefaultSession["user"];
  }
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/models/User.ts src/models/ProApplication.ts src/auth.ts src/types/next-auth.d.ts
git commit -m "Add isPro/ProApplication data model and session plumbing"
```

---

### Task 2: Admin email notification (Resend)

**Files:**
- Modify: `package.json` (add `resend` dependency, via `npm install`)
- Create: `src/lib/mail.ts`
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: `Admin` model (Task existing), `connectToDatabase()`.
- Produces: `sendAdminNotification({ subject: string; html: string }): Promise<void>` — never throws, logs and no-ops on missing config or send failure.

- [ ] **Step 1: Install the `resend` package**

Run: `npm install resend`
Expected: `package.json`/`package-lock.json` updated, install succeeds.

- [ ] **Step 2: Create the mail helper**

`src/lib/mail.ts`:
```ts
import { Resend } from "resend";
import { connectToDatabase } from "@/lib/mongodb";
import Admin from "@/models/Admin";

export async function sendAdminNotification({
  subject,
  html,
}: {
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[mail] RESEND_API_KEY not set — skipping admin notification email.");
    return;
  }

  try {
    await connectToDatabase();
    const adminEmails = await Admin.find().distinct("email");
    if (adminEmails.length === 0) {
      console.warn("[mail] No admin accounts found — skipping admin notification email.");
      return;
    }

    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    await resend.emails.send({ from, to: adminEmails, subject, html });
  } catch (error) {
    console.error("[mail] Failed to send admin notification email:", error);
  }
}
```

- [ ] **Step 3: Document the new env vars**

Append to `.env.local.example`:
```
# Resend (https://resend.com) — used to email admins when a user applies for Pro.
# Leave RESEND_API_KEY unset to skip sending (a warning is logged instead).
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/mail.ts .env.local.example
git commit -m "Add Resend-backed admin notification email helper"
```

---

### Task 3: Apply-for-Pro API route

**Files:**
- Create: `src/app/api/pro/apply/route.ts`

**Interfaces:**
- Consumes: `auth()` (Task 1), `User`/`ProApplication` models (Task 1), `sendAdminNotification` (Task 2).
- Produces: `POST /api/pro/apply` body `{ reason: string }` → `{ success: true }` (201) or `{ error: string }` (401/400/404).

- [ ] **Step 1: Create the route**

`src/app/api/pro/apply/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import ProApplication from "@/models/ProApplication";
import { sendAdminNotification } from "@/lib/mail";

const applySchema = z.object({
  reason: z.string().min(10).max(1000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in to apply." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please write a bit more about why you want Pro access (at least 10 characters)." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const user = await User.findById(session.user.id).lean();
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  if (user.isPro) {
    return NextResponse.json({ error: "You already have Pro access." }, { status: 400 });
  }

  const pending = await ProApplication.findOne({ userId: user._id, status: "pending" });
  if (pending) {
    return NextResponse.json({ error: "You already have a pending application." }, { status: 400 });
  }

  await ProApplication.create({
    userId: user._id,
    name: user.name,
    email: user.email,
    reason: parsed.data.reason,
    status: "pending",
  });

  const origin = new URL(request.url).origin;
  await sendAdminNotification({
    subject: `New Pro application from ${user.name}`,
    html: `<p><strong>${user.name}</strong> (${user.email}) applied for Pro access.</p><p>Reason: ${parsed.data.reason}</p><p><a href="${origin}/admin/pro-applications">Review in admin panel</a></p>`,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Start `npm run dev`.
1. `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3002/api/pro/apply -H "Content-Type: application/json" -d "{\"reason\":\"test\"}"` with no cookies — expect `401`.
2. Log in as a test `User` in the browser, open devtools, run:
   `fetch('/api/pro/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'I run a small print shop and need the poster maker.' }) }).then(r => r.json()).then(console.log)`
   — expect `{ success: true }`, and a `ProApplication` document with `status: "pending"` appears in MongoDB for that user.
3. Immediately repeat the same `fetch` call — expect `{ error: "You already have a pending application." }` with `400`.
4. Check the dev server console — if `RESEND_API_KEY` is unset, confirm the `[mail] RESEND_API_KEY not set` warning was logged (not a crash).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/pro/apply
git commit -m "Add POST /api/pro/apply route"
```

---

### Task 4: "Go Pro" page and apply form

**Files:**
- Create: `src/app/[locale]/(site)/pro/page.tsx`
- Create: `src/components/ProApplyForm.tsx`
- Modify: `src/messages/en.json`
- Modify: `src/messages/hin.json`
- Modify: `src/messages/pun.json`

**Interfaces:**
- Consumes: `auth()`, `User`, `ProApplication` (Task 1), `POST /api/pro/apply` (Task 3).
- Produces: page at `/{locale}/pro`; `ProApplyForm` client component (no props) that posts to `/api/pro/apply` and calls `router.refresh()` on success.

- [ ] **Step 1: Add the `pro` message namespace to `en.json`**

In `src/messages/en.json`, add a new top-level `"pro"` key (alongside `"auth"`, `"faq"`, etc.) and a `"goPro"` key inside the existing `"header"` object:
```json
  "header": {
    "searchPlaceholder": "Search tools...",
    "tools": "Tools",
    "login": "Log in",
    "join": "Join free",
    "goPro": "Go Pro"
  },
```
```json
  "pro": {
    "loginRequiredTitle": "Log in to apply for Pro",
    "loginRequiredSubtitle": "Create a free account or log in to apply for Pro access.",
    "loginCta": "Log in",
    "alreadyProTitle": "You're a Pro member",
    "alreadyProSubtitle": "Pro member since {date}. Enjoy full access to the Creative Design Studio tools.",
    "pendingTitle": "Application pending review",
    "pendingSubtitle": "Our admin team is reviewing your application. We'll upgrade your account once it's approved.",
    "formTitle": "Apply for Pro",
    "formSubtitle": "Tell us why you'd like Pro access and we'll review your application.",
    "reasonLabel": "Why do you want Pro access?",
    "reasonPlaceholder": "Tell us a bit about how you plan to use Pro tools...",
    "submitButton": "Submit application",
    "submitting": "Submitting...",
    "rejectedNotice": "Your previous application wasn't approved. You're welcome to apply again.",
    "genericError": "Something went wrong. Please try again."
  }
```
(Insert `"pro"` as its own top-level object, e.g. after `"faq"` and before `"footer"`, matching the existing key order style.)

- [ ] **Step 2: Add the matching Hindi translations**

In `src/messages/hin.json`, add `"goPro": "प्रो लें"` inside `"header"`, and this `"pro"` block:
```json
  "pro": {
    "loginRequiredTitle": "प्रो के लिए आवेदन करने हेतु लॉग इन करें",
    "loginRequiredSubtitle": "प्रो एक्सेस के लिए आवेदन करने के लिए मुफ़्त खाता बनाएं या लॉग इन करें।",
    "loginCta": "लॉग इन करें",
    "alreadyProTitle": "आप प्रो सदस्य हैं",
    "alreadyProSubtitle": "{date} से प्रो सदस्य। क्रिएटिव डिज़ाइन स्टूडियो के सभी टूल्स का पूरा उपयोग करें।",
    "pendingTitle": "आवेदन समीक्षा में है",
    "pendingSubtitle": "हमारी टीम आपके आवेदन की समीक्षा कर रही है। स्वीकृति मिलते ही आपका खाता अपग्रेड कर दिया जाएगा।",
    "formTitle": "प्रो के लिए आवेदन करें",
    "formSubtitle": "बताएं कि आप प्रो एक्सेस क्यों चाहते हैं, हम आपके आवेदन की समीक्षा करेंगे।",
    "reasonLabel": "आप प्रो एक्सेस क्यों चाहते हैं?",
    "reasonPlaceholder": "बताएं कि आप प्रो टूल्स का उपयोग कैसे करना चाहते हैं...",
    "submitButton": "आवेदन भेजें",
    "submitting": "भेजा जा रहा है...",
    "rejectedNotice": "आपका पिछला आवेदन स्वीकृत नहीं हुआ था। आप फिर से आवेदन कर सकते हैं।",
    "genericError": "कुछ गलत हो गया। कृपया दोबारा प्रयास करें।"
  }
```

- [ ] **Step 3: Add the matching Punjabi translations**

In `src/messages/pun.json`, add `"goPro": "ਪ੍ਰੋ ਲਓ"` inside `"header"`, and this `"pro"` block:
```json
  "pro": {
    "loginRequiredTitle": "ਪ੍ਰੋ ਲਈ ਅਪਲਾਈ ਕਰਨ ਲਈ ਲੌਗ ਇਨ ਕਰੋ",
    "loginRequiredSubtitle": "ਪ੍ਰੋ ਐਕਸੈਸ ਲਈ ਅਪਲਾਈ ਕਰਨ ਵਾਸਤੇ ਮੁਫ਼ਤ ਖਾਤਾ ਬਣਾਓ ਜਾਂ ਲੌਗ ਇਨ ਕਰੋ।",
    "loginCta": "ਲੌਗ ਇਨ ਕਰੋ",
    "alreadyProTitle": "ਤੁਸੀਂ ਪ੍ਰੋ ਮੈਂਬਰ ਹੋ",
    "alreadyProSubtitle": "{date} ਤੋਂ ਪ੍ਰੋ ਮੈਂਬਰ। ਕ੍ਰਿਏਟਿਵ ਡਿਜ਼ਾਈਨ ਸਟੂਡੀਓ ਦੇ ਸਾਰੇ ਟੂਲ ਵਰਤੋ।",
    "pendingTitle": "ਅਰਜ਼ੀ ਸਮੀਖਿਆ ਅਧੀਨ ਹੈ",
    "pendingSubtitle": "ਸਾਡੀ ਟੀਮ ਤੁਹਾਡੀ ਅਰਜ਼ੀ ਦੀ ਸਮੀਖਿਆ ਕਰ ਰਹੀ ਹੈ। ਮਨਜ਼ੂਰੀ ਮਿਲਦੇ ਹੀ ਤੁਹਾਡਾ ਖਾਤਾ ਅੱਪਗ੍ਰੇਡ ਕਰ ਦਿੱਤਾ ਜਾਵੇਗਾ।",
    "formTitle": "ਪ੍ਰੋ ਲਈ ਅਪਲਾਈ ਕਰੋ",
    "formSubtitle": "ਦੱਸੋ ਕਿ ਤੁਸੀਂ ਪ੍ਰੋ ਐਕਸੈਸ ਕਿਉਂ ਚਾਹੁੰਦੇ ਹੋ, ਅਸੀਂ ਤੁਹਾਡੀ ਅਰਜ਼ੀ ਦੀ ਸਮੀਖਿਆ ਕਰਾਂਗੇ।",
    "reasonLabel": "ਤੁਸੀਂ ਪ੍ਰੋ ਐਕਸੈਸ ਕਿਉਂ ਚਾਹੁੰਦੇ ਹੋ?",
    "reasonPlaceholder": "ਦੱਸੋ ਕਿ ਤੁਸੀਂ ਪ੍ਰੋ ਟੂਲ ਕਿਵੇਂ ਵਰਤਣਾ ਚਾਹੁੰਦੇ ਹੋ...",
    "submitButton": "ਅਰਜ਼ੀ ਭੇਜੋ",
    "submitting": "ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ...",
    "rejectedNotice": "ਤੁਹਾਡੀ ਪਿਛਲੀ ਅਰਜ਼ੀ ਮਨਜ਼ੂਰ ਨਹੀਂ ਹੋਈ ਸੀ। ਤੁਸੀਂ ਦੁਬਾਰਾ ਅਪਲਾਈ ਕਰ ਸਕਦੇ ਹੋ।",
    "genericError": "ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।"
  }
```

- [ ] **Step 4: Create the apply form client component**

`src/components/ProApplyForm.tsx`:
```tsx
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
```

- [ ] **Step 5: Create the `/pro` page**

`src/app/[locale]/(site)/pro/page.tsx`:
```tsx
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import ProApplication from "@/models/ProApplication";
import { Link } from "@/i18n/navigation";
import ProApplyForm from "@/components/ProApplyForm";

export default async function ProPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pro" });
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("loginRequiredTitle")}</h1>
        <p className="mt-2 text-muted">{t("loginRequiredSubtitle")}</p>
        <Link href="/login" className="brand-pill-btn mt-6 inline-block px-6 py-3 text-sm">
          {t("loginCta")}
        </Link>
      </div>
    );
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id).lean();
  const latestApplication = await ProApplication.findOne({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .lean();

  if (user?.isPro) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("alreadyProTitle")}</h1>
        <p className="mt-2 text-muted">
          {t("alreadyProSubtitle", {
            date: user.proSince ? new Date(user.proSince).toLocaleDateString() : "",
          })}
        </p>
      </div>
    );
  }

  if (latestApplication?.status === "pending") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("pendingTitle")}</h1>
        <p className="mt-2 text-muted">{t("pendingSubtitle")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">{t("formTitle")}</h1>
      <p className="mt-2 text-muted">{t("formSubtitle")}</p>
      {latestApplication?.status === "rejected" && (
        <p className="mt-4 rounded-xl bg-surface-soft px-4 py-3 text-sm text-muted">
          {t("rejectedNotice")}
        </p>
      )}
      <ProApplyForm />
    </div>
  );
}
```

- [ ] **Step 6: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 7: Manual verification**

Start `npm run dev`.
1. Visit `/en/pro` logged out — confirm the "log in" state with a working link to `/en/login`.
2. Log in as a test user with no application yet — confirm the form renders; submit it — confirm `router.refresh()` flips the page to the "pending" state without a full reload.
3. In MongoDB, manually set that user's `ProApplication.status` to `"rejected"` — reload `/en/pro` — confirm the form reappears with the rejected notice above it.
4. In MongoDB, manually set that user's `User.isPro` to `true` and `proSince` to a date — reload `/en/pro` — confirm the "already Pro" state shows that date.
5. Switch locale to `/hin/pro` and `/pun/pro` — confirm translated text renders (no missing-key errors in the console).

- [ ] **Step 8: Commit**

```bash
git add "src/app/[locale]/(site)/pro" src/components/ProApplyForm.tsx src/messages/en.json src/messages/hin.json src/messages/pun.json
git commit -m "Add Go Pro page and apply form"
```

---

### Task 5: "Go Pro" header link

**Files:**
- Modify: `src/components/Header.tsx`

**Interfaces:**
- Consumes: `session.user.isPro` (Task 1), `t("header.goPro")` (Task 4).

- [ ] **Step 1: Add the link to the desktop header**

In `src/components/Header.tsx`, inside the `status === "authenticated" && session?.user` branch of the desktop block (around the existing `<span>{session.user.name}</span>`), add a conditional link before it:
```tsx
{status === "authenticated" && session?.user ? (
  <div className="flex items-center gap-2">
    {!session.user.isPro && (
      <Link
        href="/pro"
        className="rounded-full border border-brand-light px-3 py-2 text-sm font-medium text-brand-bright transition-colors hover:bg-surface-soft"
      >
        {t("goPro")}
      </Link>
    )}
    <span className="text-sm font-medium text-foreground">
      {session.user.name}
    </span>
    <button
      type="button"
      onClick={() => signOut()}
      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft"
    >
      <FcLeave className="h-4 w-4" />
      <span>Log out</span>
    </button>
  </div>
) : (
```
(Only the `{!session.user.isPro && (...)}` block and its `Link` are new — the rest of the branch is unchanged, shown for placement context.)

- [ ] **Step 2: Add the link to the mobile drawer**

In the mobile drawer's authenticated branch (around the existing `<span>{session.user.name}</span>` near the bottom of the file), add the same conditional link, stacked above the row:
```tsx
{status === "authenticated" && session?.user ? (
  <div className="space-y-3">
    {!session.user.isPro && (
      <Link
        href="/pro"
        onClick={() => setDrawerOpen(false)}
        className="block rounded-full border border-brand-light px-3 py-2 text-center text-sm font-medium text-brand-bright transition-colors hover:bg-surface-soft"
      >
        {t("goPro")}
      </Link>
    )}
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-foreground">
        {session.user.name}
      </span>
      <button
        type="button"
        onClick={() => {
          setDrawerOpen(false);
          signOut();
        }}
        className="flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft"
      >
        <FcLeave className="h-4 w-4" />
        <span>Log out</span>
      </button>
    </div>
  </div>
) : (
```
(The outer `<div className="flex items-center justify-between gap-2">` replaces the previous top-level authenticated wrapper — nest the existing name/logout row inside the new `space-y-3` wrapper alongside the new link.)

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 4: Manual verification**

1. Log in as a non-Pro user — confirm "Go Pro" appears in both the desktop bar and the mobile drawer (resize/devtools), and clicking it navigates to `/pro`.
2. Manually set that user's `isPro: true` in MongoDB, refresh — confirm the "Go Pro" link disappears from both locations (session `isPro` is a next-login/refresh hint, so a `next-auth` `useSession().update()`-free simple page refresh triggers a fresh session fetch and reflects it since NextAuth's client re-requests `/api/auth/session` on refresh).

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx
git commit -m "Add Go Pro link to header for non-Pro signed-in users"
```

---

### Task 6: Admin Pro Applications management

**Files:**
- Create: `src/app/api/admin/pro-applications/route.ts`
- Create: `src/app/api/admin/pro-applications/[id]/route.ts`
- Create: `src/app/admin/pro-applications/page.tsx`
- Create: `src/components/admin/ProApplicationsTable.tsx`
- Modify: `src/components/admin/AdminShell.tsx`

**Interfaces:**
- Consumes: `requireAdminApi()`/`requireAdminPage()`, `auth()`, `ProApplication`/`User` models (Task 1), `AdminShell`.
- Produces: `GET /api/admin/pro-applications` → `{ id, name, email, reason, status, decidedBy, decidedAt, createdAt }[]`. `PATCH /api/admin/pro-applications/:id` body `{ action: "approve" | "reject" }` → `{ id, status }`.

- [ ] **Step 1: List route**

`src/app/api/admin/pro-applications/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import ProApplication from "@/models/ProApplication";

export async function GET() {
  const guard = await requireAdminApi();
  if (guard) return guard;

  await connectToDatabase();
  const applications = await ProApplication.find().sort({ createdAt: -1 }).lean();

  return NextResponse.json(
    applications.map((a) => ({
      id: a._id.toString(),
      name: a.name,
      email: a.email,
      reason: a.reason,
      status: a.status,
      decidedBy: a.decidedBy,
      decidedAt: a.decidedAt,
      createdAt: a.createdAt,
    }))
  );
}
```

- [ ] **Step 2: Approve/reject route**

`src/app/api/admin/pro-applications/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongodb";
import ProApplication from "@/models/ProApplication";
import User from "@/models/User";

const actionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  await connectToDatabase();
  const application = await ProApplication.findById(id);
  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  const session = await auth();
  const status = parsed.data.action === "approve" ? "approved" : "rejected";

  application.status = status;
  application.decidedBy = session?.user?.name ?? "Admin";
  application.decidedAt = new Date();
  await application.save();

  if (status === "approved") {
    await User.findByIdAndUpdate(application.userId, {
      $set: { isPro: true, proSince: new Date() },
    });
  }

  return NextResponse.json({ id: application._id.toString(), status });
}
```

- [ ] **Step 3: Admin pro-applications page**

`src/app/admin/pro-applications/page.tsx`:
```tsx
import { requireAdminPage } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import ProApplication from "@/models/ProApplication";
import AdminShell from "@/components/admin/AdminShell";
import ProApplicationsTable from "@/components/admin/ProApplicationsTable";

export default async function AdminProApplicationsPage() {
  const session = await requireAdminPage();

  await connectToDatabase();
  const applications = await ProApplication.find().sort({ createdAt: -1 }).lean();

  const initialApplications = applications.map((a) => ({
    id: a._id.toString(),
    name: a.name,
    email: a.email,
    reason: a.reason,
    status: a.status,
    decidedBy: a.decidedBy,
    decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">Pro Applications</h1>
      <p className="mt-1 text-sm text-muted">
        {initialApplications.filter((a) => a.status === "pending").length} pending.
      </p>
      <ProApplicationsTable initialApplications={initialApplications} />
    </AdminShell>
  );
}
```

- [ ] **Step 4: Pro applications table client component**

`src/components/admin/ProApplicationsTable.tsx`:
```tsx
"use client";

import { useState } from "react";

interface ProApplicationRow {
  id: string;
  name: string;
  email: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export default function ProApplicationsTable({
  initialApplications,
}: {
  initialApplications: ProApplicationRow[];
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, action: "approve" | "reject") {
    setError(null);
    const res = await fetch(`/api/admin/pro-applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to update application.");
      return;
    }
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: data.status } : a))
    );
  }

  return (
    <div className="mt-6 overflow-x-auto">
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <table className="w-full min-w-[700px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Reason</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.id} className="border-b border-border align-top">
              <td className="py-2 pr-4">{application.name}</td>
              <td className="py-2 pr-4">{application.email}</td>
              <td className="max-w-xs py-2 pr-4 whitespace-pre-wrap text-muted">{application.reason}</td>
              <td className="py-2 pr-4 capitalize">{application.status}</td>
              <td className="py-2 pr-4">
                {application.status === "pending" ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => decide(application.id, "approve")}
                      className="text-brand-bright hover:underline"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide(application.id, "reject")}
                      className="text-danger hover:underline"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted">by {application.decidedBy}</span>
                )}
              </td>
            </tr>
          ))}
          {applications.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-muted">
                No applications yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Add the nav entry**

In `src/components/admin/AdminShell.tsx`, add to `NAV_ITEMS` (after `"Users"`):
```ts
const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/pro-applications", label: "Pro Applications" },
  { href: "/admin/visitors", label: "Visitors" },
  { href: "/admin/portal-links", label: "Portal Links" },
  { href: "/admin/faqs", label: "FAQs" },
];
```

- [ ] **Step 6: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 7: Manual verification**

1. `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/api/admin/pro-applications` with no cookies — expect `401`.
2. Log in as admin, visit `/admin/pro-applications` — confirm the test application from Task 3 shows up with "pending" status and Approve/Reject buttons.
3. Click "Approve" — confirm the row updates to "approved" in the UI, and in MongoDB the `User.isPro` is now `true` with `proSince` set.
4. Create a second throwaway application (repeat Task 3 Step 3's `fetch` with a different test user), click "Reject" — confirm the row updates to "rejected" and that user's `User.isPro` remains `false` in MongoDB.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/admin/pro-applications src/app/admin/pro-applications src/components/admin/ProApplicationsTable.tsx src/components/admin/AdminShell.tsx
git commit -m "Add admin Pro Applications management (approve/reject)"
```

---

### Task 7: Admin Users — isPro toggle (revoke path)

**Files:**
- Modify: `src/app/api/admin/users/[id]/route.ts`
- Modify: `src/app/admin/users/page.tsx`
- Modify: `src/components/admin/UsersTable.tsx`

**Interfaces:**
- Consumes: existing `User` model (now with `isPro`, Task 1).
- Produces: `PATCH /api/admin/users/:id` now also accepts `{ isPro?: boolean }` and returns it in the response.

- [ ] **Step 1: Accept `isPro` in the update route**

Modify `src/app/api/admin/users/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
  isPro: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid name, email, or isPro." }, { status: 400 });
  }

  await connectToDatabase();
  const update: Record<string, string | boolean | Date | null> = {};
  if (parsed.data.name) update.name = parsed.data.name;
  if (parsed.data.email) update.email = parsed.data.email.toLowerCase();
  if (parsed.data.isPro !== undefined) {
    update.isPro = parsed.data.isPro;
    update.proSince = parsed.data.isPro ? new Date() : null;
  }

  const user = await User.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ id: user._id.toString(), name: user.name, email: user.email, isPro: user.isPro });
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

- [ ] **Step 2: Pass `isPro` into the admin users page**

Modify `src/app/admin/users/page.tsx`'s mapping:
```ts
  const initialUsers = users.map((user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    recentToolsCount: user.recentTools?.length ?? 0,
    isPro: user.isPro,
  }));
```

- [ ] **Step 3: Add the isPro column and toggle to `UsersTable`**

Modify `src/components/admin/UsersTable.tsx`:
```tsx
"use client";

import { useState } from "react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  recentToolsCount: number;
  isPro: boolean;
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

  async function toggleIsPro(user: AdminUser) {
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPro: !user.isPro }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to update Pro status.");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isPro: data.isPro } : u)));
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
      <table className="w-full min-w-[700px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Recent tools</th>
            <th className="py-2 pr-4">Pro</th>
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
                <button
                  onClick={() => toggleIsPro(user)}
                  className={
                    user.isPro
                      ? "rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand-bright"
                      : "rounded-full border border-border px-3 py-1 text-xs text-muted"
                  }
                >
                  {user.isPro ? "Pro" : "Free"}
                </button>
              </td>
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
              <td colSpan={5} className="py-4 text-center text-muted">
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

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 5: Manual verification (revoke path, end-to-end)**

1. Visit `/admin/users` as admin — confirm a "Pro"/"Free" pill shows per user, matching current DB state (including the user approved in Task 6).
2. Click the pill on that Pro user to toggle it back to "Free" — confirm the pill updates immediately and `User.isPro` becomes `false` in MongoDB.
3. As that user, reload `/en/pro` in the browser — confirm it now shows the apply form again (or pending/rejected state), not the "already Pro" state — proving the revoke actually takes effect for the user-facing flow, not just the admin table.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/users/[id]/route.ts src/app/admin/users/page.tsx src/components/admin/UsersTable.tsx
git commit -m "Add isPro toggle to admin Users page (Pro revoke path)"
```

---

### Task 8: Pro FAQ entry

**Files:**
- Modify: `src/lib/homeContentSeed.ts`

**Interfaces:**
- Consumes: none new — extends the existing `HOME_FAQS` array consumed by `npm run seed:content` / `getHomeContent()`'s fallback.

- [ ] **Step 1: Add the FAQ entry**

In `src/lib/homeContentSeed.ts`, append to `HOME_FAQS`:
```ts
  {
    question: "How do I get Pro access?",
    answer:
      "Log in to your account, then visit the \"Go Pro\" link in the header and submit a short application explaining why you'd like Pro access. Our admin team reviews every application, and your account is automatically upgraded to Pro as soon as it's approved.",
    order: 5,
  },
```

- [ ] **Step 2: Re-seed home content**

Run: `npm run seed:content`
Expected: `Upserted FAQ: How do I get Pro access?` (or equivalent per-item log line) printed, script exits 0. If MongoDB isn't reachable in this environment, skip this step and note it for the user to run themselves before shipping.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Visit `/en` in the browser, scroll to the FAQ section — confirm "How do I get Pro access?" appears and expands to show the answer. Confirm it's also editable at `/admin/faqs` (existing admin FAQ UI, no new admin work needed here).

- [ ] **Step 5: Commit**

```bash
git add src/lib/homeContentSeed.ts
git commit -m "Add Pro access FAQ entry"
```
