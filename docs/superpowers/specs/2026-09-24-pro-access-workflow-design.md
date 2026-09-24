# Pro Access Workflow — Design Spec

Date: 2026-09-24
Status: Approved

## Purpose

Sub-project 1 of the "Creative Design Studio" initiative. Give logged-in users a way to apply
for Pro access, give the admin a way to review and approve/reject those applications (with an
email notification), and let admins revoke Pro status. This is a prerequisite for later
Pro-gating the Creative Design Studio tools (sub-project 3) and their template galleries
(sub-project 2), which are not part of this spec.

## Non-goals

- No payment processing — this is a manual approval workflow, not a paid subscription.
- No expiry/renewal of Pro status — permanent until an admin revokes it.
- No gating of any tool yet — `isPro` is introduced but not enforced anywhere in this spec.
- No new FAQ admin UI — reuses the existing FAQ admin CRUD (from the admin panel work).

## Architecture

### 1. Data model

- `src/models/User.ts` gains `isPro: boolean` (default `false`) and `proSince: Date | null`
  (default `null`).
- New `src/models/ProApplication.ts`: `{ userId (ref User), name, email, reason, status:
  "pending" | "approved" | "rejected", decidedBy: string | null, decidedAt: Date | null }`,
  timestamps. `name`/`email` are snapshotted at apply time (independent of later profile edits).
  Kept as its own collection rather than embedded on `User` so there's an audit trail and a
  user can re-apply after a rejection.

### 2. Auth/session plumbing

- `src/auth.ts` `jwt` callback: on sign-in, also stash `token.isPro` by reading `User.isPro`
  (Credentials `authorize()` already returns the full user doc's `id`; fetch `isPro` there or in
  `jwt` — follow whichever the existing provider's `authorize()` return shape supports with the
  least change). `session` callback copies `token.isPro` onto `session.user.isPro`.
- `src/types/next-auth.d.ts`: extend `Session.user` with `isPro: boolean`.
- Because Pro status can change after a session's JWT is issued (admin approves/revokes), and
  this repo has no session-refresh mechanism, the apply-page and any future gating must treat
  the session's `isPro` as a hint and re-check against the DB for anything security-sensitive.
  For this spec, the `/pro` page and `/api/pro/apply` route always read `User.isPro` fresh from
  the DB rather than trusting the JWT claim.

### 3. User-facing flow

- New page `src/app/[locale]/(site)/pro/page.tsx` ("Go Pro"):
  - Not logged in → prompt to log in/sign up.
  - Logged in, `user.isPro` → "You're a Pro member since {proSince}" state.
  - Logged in, latest `ProApplication.status === "pending"` → "Application pending review".
  - Otherwise → minimal form (`reason` textarea + submit), including if latest status is
    `"rejected"` (re-apply allowed).
- `POST /api/pro/apply`: requires session; 400s if a pending application already exists; creates
  the `ProApplication` (`status: "pending"`), then sends the admin notification email
  (failure to send is logged, not fatal — the application is still recorded).
- `Header.tsx`: add a "Go Pro" link next to the signed-in user's name (desktop bar + mobile
  drawer), shown only when `session.user.isPro` is falsy, pointing at `/pro`. Fetches nothing
  extra — reads straight off the existing `useSession()` call.

### 4. Admin-facing flow

- `src/app/api/admin/pro-applications/route.ts` (GET list, newest first).
- `src/app/api/admin/pro-applications/[id]/route.ts` (PATCH `{ action: "approve" | "reject" }`):
  guarded by `requireAdminApi()`. Approve: sets application `status: "approved"`, `decidedBy`,
  `decidedAt`; sets `User.isPro = true`, `proSince = now`. Reject: sets application `status:
  "rejected"`, `decidedBy`, `decidedAt`; no change to `User.isPro`.
- `src/app/admin/pro-applications/page.tsx` (server component, `requireAdminPage()`, lists via
  direct DB read) + `ProApplicationsTable.tsx` (client component, Approve/Reject buttons calling
  the PATCH route) — mirrors the existing `PortalLinksManager`/`UsersTable` pattern.
- `src/app/admin/users/page.tsx` + `UsersTable.tsx`: add an "isPro" column with a toggle button.
  Toggling calls a new `PATCH /api/admin/users/[id]` field (`isPro`) — the route already exists
  for edit; extend its accepted fields rather than adding a new endpoint. Toggling off is the
  revoke path; toggling on bypasses the application flow entirely (admin override), which is
  intentional since it's the same trust boundary as approving an application.
- Sidebar nav (`src/app/admin/layout.tsx`) gets a "Pro Applications" entry.

### 5. Email notification

- Add the `resend` package as a dependency.
- New `src/lib/mail.ts`: thin wrapper exporting `sendAdminNotification({ subject, html })` that
  constructs a `Resend` client from `RESEND_API_KEY`, sends `from: RESEND_FROM_EMAIL` to every
  address found in the `Admin` collection (`Admin.find().distinct("email")`), and swallows/logs
  errors (never throws) so a misconfigured or missing key doesn't break the apply flow in dev.
  If `RESEND_API_KEY` is unset, logs a warning and no-ops instead of sending.
- `.env.local.example` gains `RESEND_API_KEY=` and `RESEND_FROM_EMAIL=onboarding@resend.dev`
  (Resend's shared sandbox sender, works without a verified domain) with a comment that real
  delivery requires the user's own key.
- Email body: applicant name/email, their reason, and a link to
  `${NEXTAUTH_URL or request origin}/admin/pro-applications`.

### 6. FAQ

- `src/lib/homeContentSeed.ts` `HOME_FAQS` gains one entry: "How do I get Pro access?" →
  "Log in, then visit the Go Pro page from the header and submit a short application. Our admin
  team reviews it and you'll be upgraded to Pro once approved." `order` continues the existing
  sequence.
- Re-running `npm run seed:content` upserts it; from then on it's editable via the existing
  admin FAQ UI like any other FAQ.

## Data flow summary

User logs in → visits `/pro` → submits reason → `ProApplication` created (`pending`) → admin
emailed via Resend → admin reviews at `/admin/pro-applications` → Approve/Reject → on approve,
`User.isPro = true` → user's *next* fresh session/login reflects Pro (session claim is a hint,
DB is authoritative) → admin can later revoke via the `isPro` toggle on `/admin/users`.

## Error handling

- `/api/pro/apply`: 401 if unauthenticated, 400 if a pending application already exists,
  validated with `zod` (reason: non-empty, reasonable max length) matching the existing
  `signup` route convention.
- `/api/admin/pro-applications/[id]`: `requireAdminApi()` 401 guard; 404 if the application
  doesn't exist; 400 for an invalid `action` value.
- Email sending never throws into the request path — logged failures only.

## Testing

No test framework exists in this repo. Verification is manual against the dev server connected
to the real `toolnest` database: sign up/log in as a normal user, apply for Pro, confirm the
admin receives the email (or see the logged warning if `RESEND_API_KEY` is unset), approve from
`/admin/pro-applications`, confirm `isPro` toggle appears correctly on `/admin/users`, confirm
the FAQ entry renders on the homepage. `npm run build` and `npx tsc --noEmit` must pass.
