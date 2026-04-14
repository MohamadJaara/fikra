# Implementation Status

Feature-by-feature checklist comparing the original spec against the current codebase.

## 1. Access & Security

| Requirement                                | Status  | Notes                                                                                                                 |
| ------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------- |
| Configurable email domain gate             | Done    | Server-side in `convex/lib.ts:getAuthenticatedUser`; also client-side hint in `AppShell.tsx` and `signin/page.tsx`    |
| GitHub OAuth + magic link (Resend)         | Done    | `convex/auth.ts`                                                                                                      |
| Auth mandatory for all app actions         | Done    | `middleware.ts` protects `/product(.*)`; every Convex mutation/query calls `getAuthenticatedUser`                     |
| Store user name, email, avatar, org domain | Done    | Convex Auth handles storage; `users.ts` provides `viewer` query                                                       |
| Server-side input validation               | Done    | `validateStringLength` + `sanitizeText` in `convex/lib.ts`; enum validation for statuses, roles, resource tags        |
| Prevent unauthorized reads/writes          | Done    | Owner checks on edit/delete idea, resolve/remove resources; author check on comment edit/delete; duplicate-join guard |
| Schema designed for future RBAC            | Partial | Schema uses simple `ownerId` ownership. No role/permission fields yet, but schema is clean enough to extend           |

## 2. Core Flows

### 2.1 Add Ideas

| Requirement                       | Status | Notes                                               |
| --------------------------------- | ------ | --------------------------------------------------- |
| Title field                       | Done   | Max 120 chars                                       |
| One-line pitch                    | Done   | Max 200 chars                                       |
| Problem it solves                 | Done   | Max 1000 chars                                      |
| Who it's for (target audience)    | Done   | Max 500 chars                                       |
| Skills needed                     | Done   | Comma-separated free text                           |
| Team size wanted                  | Done   | 1-20                                                |
| Status enum                       | Done   | `exploring`, `forming_team`, `full`, `building`     |
| Looking-for-roles selection       | Done   | Frontend, Backend, Design, PM, Security, Demo/Pitch |
| Resource request tags at creation | Done   | All 8 tags available                                |
| Resource notes                    | Done   | Optional, shown when tags selected                  |

### 2.2 Browse Ideas

| Requirement                                                                                                          | Status | Notes                                                                                      |
| -------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Idea cards showing title, pitch, status, owner, team count, team size, missing roles, resource tags, reaction counts | Done   | `IdeaCard.tsx`                                                                             |
| Search by title/pitch                                                                                                | Done   |                                                                                            |
| Filter by status                                                                                                     | Done   |                                                                                            |
| Filter by skills/roles needed                                                                                        | Done   | Filters by missing roles                                                                   |
| Filter by resource tags                                                                                              | Done   |                                                                                            |
| Filter by "needs teammates"                                                                                          | Done   |                                                                                            |
| Filter by "unresolved resource needs"                                                                                | Done   |                                                                                            |
| Sorting                                                                                                              | Done   | Sort by newest, oldest, most reactions, most interest via `Select` dropdown on browse page |

### 2.3 Interest Before Commitment

| Requirement                                     | Status | Notes                                                               |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------- |
| "I'm interested" action (separate from joining) | Done   | `convex/interest.ts` — express/remove                               |
| "I'm joining" action (separate from interest)   | Done   | `convex/memberships.ts` — join/leave                                |
| Both reflected in UI                            | Done   | Separate sections on idea detail page; interest badge on idea cards |

### 2.4 Join Ideas

| Requirement                                                           | Status | Notes                              |
| --------------------------------------------------------------------- | ------ | ---------------------------------- |
| Join as team member                                                   | Done   | With optional role selection       |
| Prevent duplicate joins                                               | Done   | Checked server-side                |
| Allow leaving                                                         | Done   | Owner cannot leave their own idea  |
| Show current members on detail page                                   | Done   | With avatars, names, roles         |
| Team completeness display (`2/5 members`, `missing design + backend`) | Done   | Progress bar + missing role badges |
| Team size soft cap (not enforced)                                     | Done   | Displayed but not blocking         |

### 2.5 Resource Requests

| Requirement                                   | Status | Notes                                                                                                                             |
| --------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Attach resource requests with structured tags | Done   | 8 predefined tags                                                                                                                 |
| Optional notes on requests                    | Done   |                                                                                                                                   |
| Owner can resolve/unresolve                   | Done   |                                                                                                                                   |
| Owner can remove requests                     | Done   |                                                                                                                                   |
| Organizers can scan/filter resource needs     | Done   | `getAllUnresolved` query; shown in Activity page Resources tab                                                                    |
| Add resource requests after idea creation     | Done   | `resourceRequests.add` mutation exists in backend, but no UI button on the detail page to add new resource requests post-creation |

### 2.6 Comments & Discussion

| Requirement               | Status | Notes                                                             |
| ------------------------- | ------ | ----------------------------------------------------------------- |
| Threaded comments         | Done   | `parentId` support; replies shown with indent                     |
| Quick prompts in composer | Done   | 4 prompts: problem, MVP, help, risks                              |
| Comment edit              | Done   | Edit button for comment authors; inline textarea with save/cancel |
| Comment delete            | Done   | Delete button for authors and idea owner; confirmation dialog     |

### 2.7 Reactions

| Requirement                    | Status | Notes                                    |
| ------------------------------ | ------ | ---------------------------------------- |
| Lightweight reactions on ideas | Done   | Toggle on/off                            |
| 4 reaction types with emoji    | Done   | Interested, Exciting, Clever, Might Join |

## 3. Main Pages

| Page             | Status | Notes                                                                                     |
| ---------------- | ------ | ----------------------------------------------------------------------------------------- |
| A. Browse Ideas  | Done   | Search, filters, idea card grid                                                           |
| B. Idea Detail   | Done   | Full info, team, reactions, interest, comments, resources                                 |
| C. Create Idea   | Done   | Structured form with validation                                                           |
| D. Edit Idea     | Done   | Owner-only; pre-fills form. Note: resource requests cannot be edited/added from edit form |
| E. My Activity   | Done   | Tabs: Created, Joined, Interested, Resources (unresolved across all ideas)                |
| Splash / Landing | Done   | Public page with Get Started / Sign In                                                    |
| Sign In          | Done   | GitHub OAuth + Resend magic link, domain hint                                             |

## 4. UI / UX Polish

| Feature                              | Status  | Notes                                                                        |
| ------------------------------------ | ------- | ---------------------------------------------------------------------------- |
| Responsive layout (desktop + mobile) | Done    | Sidebar collapses to hamburger on mobile                                     |
| Dark mode / theme toggle             | Done    | `next-themes` with toggle in sidebar                                         |
| Loading states                       | Done    | Spinner / "Loading..." placeholders                                          |
| Empty states                         | Done    | Guide users to create or browse                                              |
| Badges for missing roles             | Done    | Orange-highlighted badges                                                    |
| Visual completeness meter            | Done    | Progress bar on cards and detail page                                        |
| "Needs help" indicators              | Done    | Missing roles, unresolved resource badges                                    |
| Error states                         | Partial | Toast notifications for mutations; no dedicated error boundaries or retry UI |

## 5. Not Yet Implemented

These items from the spec have no implementation:

| Item                                           | Details                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add resource requests after idea creation (UI) | Backend `resourceRequests.add` mutation exists but there is no UI affordance on the idea detail page to add new resource requests post-creation                                                                                                               |
| Sort/browse by popularity or reaction count    | Done — Sort dropdown on browse page: newest, oldest, most reactions, most interest. Interest count shown on idea cards                                                                                                                                        |
| Role-based permissions / admin actions         | Schema is ready but no admin role or organizer dashboard exists                                                                                                                                                                                               |
| Notification or mention system                 | Done — Bell icon with unread badge in sidebar + mobile header (popover); full `/product/notifications` page; 5 types: member_joined, interest_expressed, reaction_added, comment_added, comment_reply. Self-notifications skipped. Mark read / mark all read. |
| Restrict joining multiple ideas                | Spec says "unless intentionally restricted" — currently unrestricted with no toggle                                                                                                                                                                           |
