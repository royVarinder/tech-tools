# PrintBro

A multi-tool file utility website built with Next.js (App Router), Tailwind CSS, MongoDB, and next-intl.

## Features

- Home page listing all tools, pulled from MongoDB (`GET /api/tools`, with a static fallback if MongoDB is unreachable).
- Header with logo, live tool search, a Tools dropdown, and Log in / Join buttons.
- Combined Login/Signup modal (tabs in a single component), backed by NextAuth credentials auth + MongoDB.
- FAQ section on the home page.
- Full i18n routing: `/en`, `/hin`, `/pun` (English, Hindi, Punjabi) via `next-intl`.
- Tools (all run client-side in the browser — files never leave the device):
  - JPG to PDF, PNG to PDF (pdf-lib)
  - PDF to JPG (pdfjs-dist page rendering)
  - PNG to JPG (canvas)
  - Delete PDF Page (thumbnail picker + pdf-lib)
  - Merge PDF (pdf-lib, reorder before merging)
  - Photo Crop & Resize (react-image-crop + canvas)
  - Resume Maker (form + live preview, exports PDF via pdf-lib)
- Fully responsive with Tailwind CSS.

## Getting started

1. Make sure a local MongoDB instance is running (default: `mongodb://127.0.0.1:27017`).
2. Copy the env example and adjust if needed:
   ```bash
   cp .env.local.example .env.local
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Seed the tools collection:
   ```bash
   npm run seed
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```
6. Visit `http://localhost:3000` (redirects to `/en`). Try `/hin` and `/pun` for the other languages.

## Project structure

- `src/app/[locale]/...` — locale-aware routes (home, `tools/[slug]`)
- `src/app/api/...` — tools list, signup, and NextAuth route handlers
- `src/components/tools/...` — one component per tool
- `src/models/` — Mongoose models (`Tool`, `User`)
- `src/messages/{en,hin,pun}.json` — translation strings
- `scripts/seed-tools.mjs` — seeds/updates the `tools` collection in MongoDB
