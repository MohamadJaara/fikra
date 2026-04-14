# Fikra — Hackathon Idea Board

Built with Next.js 15 (App Router) + Convex backend + Convex Auth + shadcn/ui (new-york style).

## Commands

- `npm run dev` — starts both frontend (Next.js with Turbopack) and backend (`convex dev`) in parallel
- `npm run predev` — one-time setup: pushes Convex schema, runs `setup.mjs` for auth env vars, opens Convex dashboard
- `npm run build` — `next build`
- `npm run lint` — `next lint` (uses `next/core-web-vitals` + `next/typescript` via flat config in `eslint.config.mjs`)
- Formatter: Prettier with empty config (all defaults)

No test framework is configured. No CI workflows exist.

## Architecture

### Two-process dev environment

Frontend (Next.js) and backend (Convex) run as separate processes via `npm-run-all --parallel`. The `convex dev` process watches `convex/` and auto-pushes functions/schema to the Convex deployment. The `convex/_generated/` directory is auto-generated — never edit it.

### Convex backend (`convex/`)

- `schema.ts` — database tables: `ideas`, `ideaMembers`, `ideaInterest`, `comments`, `reactions`, `resourceRequests`, `notifications`, plus Convex Auth tables
- `auth.ts` — Resend (magic link) auth provider
- `auth.config.ts` — auth provider config referencing `CONVEX_SITE_URL`
- `http.ts` — HTTP routes for auth callbacks only
- `lib.ts` — shared helpers: `getAuthenticatedUser` (enforces email domain gate via env vars), `sanitizeText`, `validateStringLength`; re-exports domain constants from `lib/constants.ts`
- Business logic files: `ideas.ts`, `comments.ts`, `interest.ts`, `memberships.ts`, `reactions.ts`, `resourceRequests.ts`, `notifications.ts`, `users.ts`

### Next.js frontend (`app/`)

- `(splash)/` — public landing page (no auth required)
- `signin/` — sign-in page (redirects to `/product` if already authenticated)
- `product/` — all protected routes (requires auth via `middleware.ts`)
  - `layout.tsx` — wraps children in `ConvexClientProvider` + `AppShell`
  - `ideas/` — idea CRUD pages
  - `activity/` — activity feed
  - `notifications/` — user notifications
  - `onboarding/` — post-signup onboarding flow
  - `settings/` — user settings
- `middleware.ts` enforces: `/product(.*)` requires auth, `/signin` redirects away if authenticated

### Shared code

- `lib/constants.ts` — domain enums: statuses, roles, resource tags, reaction types, sort options, and their display labels/colors
- `lib/types.ts` — TypeScript types for idea lists, details, members, comments, resource requests
- `lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `components/ui/` — shadcn/ui components (configured via `components.json`, new-york style, Lucide icons)

### Path alias

`@/*` maps to repo root (configured in `tsconfig.json` and `components.json`).

## Key constraints

- **Email domain gate**: `getAuthenticatedUser` in `convex/lib.ts` restricts access using the `ALLOWED_DOMAIN` env var and an optional `ALLOWED_EMAILS` comma-separated whitelist. Both are Convex environment variables, not `.env.local`. Do not hardcode allowed domains in code.
- **Auth env vars**: Requires `.env.local` with `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT`. The `predev` script walks through Resend credential setup.
- **Convex-generated imports**: Frontend imports Convex API as `@/convex/_generated/api`; backend functions import from `./_generated/server`. Both are auto-generated.
- **shadcn/ui**: Use `npx shadcn@latest add <component>` to add new UI components. Config is in `components.json`.
- **No tests**: No test runner or test files exist. Verify changes manually via `npm run dev`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->
