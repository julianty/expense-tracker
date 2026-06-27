# Deploy Checklist — Splitwise-lite

Your by-hand setup to take the app from "runs locally on demo data" to "hosted on
Vercel + Supabase with real persistence." Ordered so each phase unblocks the next.

> **Current state (read first):** the UI and all flows are built, but every read/
> write goes through `src/lib/store.ts` (an in-memory demo store), **not** the
> database. The Prisma schema (`prisma/schema.prisma`) and the auth gate
> (`src/lib/auth.ts`) exist but are not yet wired into the pages/actions.
> Phase 5 (the code-wiring) is the dev task that makes Supabase actually do
> anything — until then a Vercel deploy will look right but won't persist data
> across requests. Everything in Phases 0–4 is account/secret setup you do by
> hand; Phase 5 is the handoff back to me.

---

## Phase 0 — Source control
- [ ] `git init` in the project root, commit the current code.
- [ ] Create a GitHub repo (e.g. `splitwise-lite`), add it as `origin`, push.
- [ ] Confirm `.env*` is gitignored (it is) so secrets never get committed.

## Phase 1 — Supabase project
- [ ] Create a Supabase account / org and a new **project**. Note the **region**
      (put DB + app in nearby regions).
- [ ] Set a strong database password (you'll need it for the connection strings).
- [ ] From **Project Settings → API**, copy:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public/anon)
  - `SUPABASE_SERVICE_ROLE_KEY` (**server-only — never expose to the browser**)
- [ ] From **Project Settings → Database → Connection string**, copy both:
  - `DATABASE_URL` — pooled connection, port **6543**, append `?pgbouncer=true`
        (used at runtime by serverless functions)
  - `DIRECT_URL` — direct connection, port **5432** (used by Prisma migrations)

## Phase 2 — Supabase config
- [ ] **Auth → Providers**: enable **Email** sign-in (email + password). Decide
      whether to require email confirmation (off is simpler for a demo).
- [ ] **Storage**: create a **bucket named `receipts`** for expense images.
      Decide public vs. signed-URL access (signed URLs are safer).
- [ ] (Optional) Add yourself as the first test user in **Auth → Users**.

## Phase 3 — Local environment
- [ ] Copy `.env.local.example` → `.env.local` and fill in all values from Phase 1:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `DATABASE_URL`, `DIRECT_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (add this line — not in the example yet)
  - `AUTH_SECRET` — generate a random value: `openssl rand -base64 32`
  - `FX_API_URL` — pick one (no key needed for frankfurter):
        `https://api.frankfurter.app` (or open.er-api.com if you want a keyed one)
- [ ] Run the first migration against Supabase:
  - `npm run db:generate` (Prisma client)
  - `npm run db:migrate` (creates the tables — needs `DIRECT_URL`)
- [ ] (Optional) `npm run db:studio` to confirm the tables exist.

## Phase 4 — Vercel hosting
- [ ] Create a Vercel account, **Import** the GitHub repo (Next.js auto-detected).
- [ ] In **Project → Settings → Environment Variables**, add the *same* set as
      `.env.local` for **Production** (and Preview if you want PR previews):
  - Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `DATABASE_URL`,
        `DIRECT_URL`, `FX_API_URL`
- [ ] Make sure the build uses the **pooled** `DATABASE_URL` (6543) at runtime —
      direct connections will exhaust on serverless.
- [ ] Deploy. Verify the build succeeds on a Preview before promoting to Prod.
- [ ] Add your Vercel domain to Supabase **Auth → URL Configuration** (Site URL +
      redirect URLs) so login redirects work.

## Phase 5 — Wire the app to the database (dev task — hand back to me)
These are code changes, not console clicks. Do this **before** relying on the
hosted app for real data:
- [ ] Replace the query/mutation calls in `src/lib/store.ts` with Prisma queries
      (the shapes already mirror the schema, so it's mechanical).
- [ ] Have `src/app/actions.ts` call `requireAuth({ groupId })` from
      `src/lib/auth.ts` (already written) instead of the demo `currentMemberId`.
- [ ] Implement the real FX fetch (one cached call/day) using `FX_API_URL`,
      replacing the static table in `src/lib/fx.ts`.
- [ ] Implement receipt upload to the Supabase `receipts` bucket from the expense
      form (currently a no-op file input).
- [ ] Seed the demo group into the real DB (a Prisma seed script) so the landing
      page preview keeps working.
- [ ] Re-run `npm run build` and smoke-test login, add expense, settle, revert,
      and share-link claim against the real DB.

## Phase 6 — Post-launch (nice to have)
- [ ] Enable Supabase RLS as defense-in-depth (writes still go through server
      actions with the service key — RLS is not the auth surface, per the brief).
- [ ] Set a rate limit on any share-link-driven writes before adding the receipt
      scan fast-follow.
- [ ] Turn on Vercel Analytics / Supabase logs to watch the free-tier limits.

---

### Quick reference — env vars
| Var | Where | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API settings | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API settings | public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API settings | **server-only** |
| `DATABASE_URL` | Supabase DB (pooler, 6543, `?pgbouncer=true`) | server-only |
| `DIRECT_URL` | Supabase DB (direct, 5432) | server-only (migrations) |
| `AUTH_SECRET` | `openssl rand -base64 32` | **server-only** |
| `FX_API_URL` | frankfurter.app / open.er-api.com | server-only |
