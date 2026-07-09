# Implementation status

Fikra supports multiple hackathons with event-scoped ideas, participants, roles, resources, rooms, announcements, voting, notifications, and admin tools.

## Implemented

- Resend magic-link authentication with server-side email-domain and allowlist enforcement.
- Hackathon lifecycle management: draft, upcoming, active, completed, and archived.
- Event-specific participant onboarding, roles, and onsite/remote mode.
- Idea creation, editing, shelving, ownership transfer, duplicate linking/merge, and bounded deletion cleanup.
- Browse/search/filter/sort, discovery recommendations, saved ideas, people, profiles, and activity.
- Team membership, interest, reactions, threaded comments, mentions, resource requests, rooms, announcements, and notifications.
- Admin dashboards for events, ideas, users, roles, categories, resources, rooms, comments, announcements, and voting.
- Responsive light/dark UI with global current-event routes and explicit `/product/h/[hackathonSlug]` routes.
- Vitest/convex-test coverage, ESLint, route-aware typechecking, and production builds in CI.

## Migration state

The codebase is in a widen–migrate–narrow rollout for legacy single-event data. Compatibility reads and writes remain until the batched hackathon-scope migrations finish and verification succeeds. Destructive orphan cleanup and legacy `eventSettings` cleanup are intentionally separate manual runners.

Do not make optional `hackathonId` fields required or remove compatibility helpers until the production migration has completed and its rollback window has closed.

## Remaining work

- Run and verify the production scope migration, then perform the narrow-schema deploy.
- Remove temporary legacy global-role/event-setting adapters after the rollback window.
- Add browser E2E coverage for participant onboarding/idea CRUD and the admin event lifecycle.
- Continue bounding admin analytics and other aggregate-heavy reads as production scale requires.
