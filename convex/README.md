# Fikra Convex backend

The backend is event-scoped. `hackathons` is the canonical event model, while `platformSettings.currentHackathonId` selects the compatibility/current event. Participant roles, participation mode, and onboarding live in `hackathonParticipants`.

Before changing Convex functions, read [`_generated/ai/guidelines.md`](./_generated/ai/guidelines.md).

## Safety rules

- Never edit `_generated/` files manually.
- New event-owned records must have a concrete `hackathonId`.
- Validate that referenced records belong to the same hackathon.
- Participant mutations require completed event participation and must respect completed/archived and voting locks.
- Use indexes and bounded reads on growing tables; use the migrations component for backfills.
- Treat `eventSettings` and global user roles/mode as temporary legacy compatibility data.

## Verification

From the repository root:

```bash
npm run check
npm run build
```

Convex tests live beside the functions as `*.test.ts` and run with Vitest plus `convex-test`.

## Migrations

Migration definitions are in `migrations.ts`. They are manual, batched, and resumable. Always dry-run against the intended deployment, inspect component status and the scope verification report, and keep destructive cleanup runners separate from normal backfills. Never run a production migration merely by starting the development server.
