# purchaseer

Make every construction project profitable on purpose, not by accident — by giving owners the visibility to act before the money is gone. purchaseer is a mobile-first purchasing platform that turns every Request Slip, Purchase Order, and Liquidation into real-time project-level visibility, purpose-built for the local Request Slip → PO → Liquidation workflow used by small-to-mid construction firms in the Philippines and Latin America.

See [`PRODUCT-PROFILE.md`](./PRODUCT-PROFILE.md) for full product context and [`.chalk/sprint-01/PLAN.md`](./.chalk/sprint-01/PLAN.md) for the sprint-01 technical plan.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind
- Supabase (Postgres + Auth + Storage)
- Resend (transactional email)
- Sentry (errors)
- Vitest (unit), Playwright (E2E)

## Local development

Prerequisites:

- Node 22+
- [pnpm](https://pnpm.io/) 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for the local Postgres + Auth stack)
- Docker (Supabase CLI uses it under the hood)

```bash
# 1. Install deps
pnpm install

# 2. Copy env template
cp .env.local.example .env.local
# fill in the Supabase values printed by `supabase start` below

# 3. Start the local Supabase stack (Postgres, Auth, Storage on :54321)
supabase start

# 4. Apply migrations
supabase db reset

# 5. Seed the demo workspace (idempotent)
pnpm seed
# pass --reset to wipe demo-workspace rows before re-seeding:
pnpm seed -- --reset

# 6. Run the dev server
pnpm dev
# -> http://localhost:3000
```

The seed script prints generated passwords for `owner@purchaseer.dev` and `pm@purchaseer.dev` to stdout. Re-running the seed rotates the passwords (idempotent).

### Environment variables

See [`.env.local.example`](./.env.local.example). Key vars:

| Var | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server Supabase clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Seed script + server-only admin tasks (never ship to browser) |
| `RESEND_API_KEY` | Invite + approval emails |
| `TEST_INVITE_SECRET` | Dev-only `/api/test-only/last-invite` endpoint used by the Playwright golden path |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error reporting (leave blank to disable) |

## Tests

```bash
pnpm lint          # eslint
pnpm test          # vitest unit + integration
pnpm test:e2e      # playwright golden path (mobile viewport)
pnpm build         # next build
```

The E2E suite runs against the local dev server on a 390x844 (iPhone 14) viewport and exercises the full signup → invite → project → PO → approval → dashboard refresh path. It depends on the dev-only `/api/test-only/last-invite` endpoint — disabled when `NODE_ENV=production` and additionally gated by the `x-test-secret` header.

## Deploy (Vercel staging)

A `vercel.json` is checked in with framework + region pinning. Credentials are not configured in this repo; deploy is a manual operator step:

```bash
# One-time
pnpm dlx vercel link

# Push environment variables to Vercel (or set via dashboard):
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_URL preview
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
pnpm dlx vercel env add SUPABASE_SERVICE_ROLE_KEY preview
pnpm dlx vercel env add RESEND_API_KEY preview
pnpm dlx vercel env add SENTRY_DSN preview

# Deploy a preview build
pnpm build
pnpm dlx vercel deploy --prebuilt
```

Point preview deploys at a Supabase **staging** project (separate from prod). Migrations should be applied with `supabase db push` against the staging project before promoting a deploy. Manual smoke on a real phone over LTE is required before sign-off — see `.chalk/sprint-01/PLAN.md`.

## Layout

```
src/
  app/            Next.js App Router (pages, route handlers)
    api/_test/    Dev-only endpoints (gated; 404 in prod)
  lib/            Supabase clients, auth, email, rate limit
  middleware.ts   Auth + workspace scoping
supabase/
  migrations/     SQL migrations (Supabase CLI)
scripts/
  seed.ts         Demo seed (pnpm seed)
tests/
  unit/           Vitest unit tests
  integration/    Vitest integration (RLS, route handlers)
  e2e/            Playwright golden path
```
