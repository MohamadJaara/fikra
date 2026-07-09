# Fikra — Hackathon Idea Board

> **Fikra** (فكرة) means **"idea"** in Arabic. It captures the essence of the app — a space where ideas are born, shared, and brought to life. The name reflects the spark of inspiration that hackathons are all about: a single _fikra_ can grow into something impactful when the right people come together around it.

**Fikra** is a self-hosted, multi-event hackathon idea management app. It lets participants submit ideas, browse what others are working on, express interest, join teams, request resources, and discuss — all in a lightweight, fast interface.

Access is restricted by email domain. All authorization is enforced server-side.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, shadcn/ui (new-york style)
- **Backend**: Convex (database, server functions, real-time subscriptions)
- **Auth**: Convex Auth with Resend magic link
- **Language**: TypeScript (strict mode)

## Features

### Browse Ideas

Search and filter a grid of idea cards. Filter by status, missing roles, resource tags, and whether a team still needs members or resources. Each card shows the title, pitch, status, owner, team progress, missing roles, resource needs, and reaction counts.

### Create & Edit Ideas

Structured form with: title, one-line pitch, problem statement, target audience, skills needed, desired team size, current status, roles being sought, and optional resource request tags with notes. Owners can edit or delete their ideas while the event is writable.

### Multiple Hackathons

Admins can create, activate, complete, archive, and clone configuration between hackathons. Participant data, ideas, roles, resources, rooms, voting, and notifications are scoped to the selected event. Completed and archived events are read-only.

### Interest & Joining (Two Separate Actions)

- **"I'm Interested"** — lightweight signal that you like an idea
- **"Join Team"** — commitment to participate, with an optional role selection

These are tracked separately so teams can distinguish curious followers from actual members.

### Team Management

See who's on the team, what roles are filled, and what's still missing. A visual progress bar shows team completeness (e.g. `2/5 members`). Members can leave; owners cannot leave their own idea.

### Resource Requests

Attach structured resource tags (Linux VPS, Mac Mini, LLM API Key, Design Help, Security Review, Legal/Compliance, Hardware, Mentoring) with optional notes. Owners can mark requests as resolved or remove them. The My Activity page shows all unresolved resource needs across the app.

### Reactions

Lightweight emoji reactions on ideas: Interested, Exciting, Clever, Might Join. Toggle on/off. Helps ideas stand out without a harsh ranking system.

### Comments & Discussion

Threaded comments on each idea with @mention support (type `@handle` to tag someone). Mentioned users get notified automatically. Quick-prompt buttons in the composer (What problem are you solving? What would an MVP look like? What help do you need? Any risks or blockers?) to keep discussion focused.

### Notifications

Real-time notifications for activity on your ideas: when someone joins, expresses interest, reacts, comments, replies, or mentions you. Unread badge in the sidebar. Mark individual notifications or all as read.

### My Activity

Personal dashboard with four tabs:

- **Created** — ideas you submitted
- **Joined** — teams you're on
- **Interested** — ideas you've expressed interest in
- **Resources** — all unresolved resource requests across the app

### Onboarding

Users join each hackathon through an event-scoped profile flow. Names remain global, while roles and participation mode are specific to the selected event. Names are auto-parsed from the email for convenience.

### Settings

Manage your name and event-specific participation settings. Email is read-only.

### Dark Mode

System-aware theme with a manual toggle in the sidebar.

### Responsive Design

Full sidebar navigation on desktop; hamburger menu on mobile. All pages adapt to smaller screens.

## Getting Started

### Prerequisites

- Node.js 22 (see `.node-version`)
- A Convex account and deployment

### First-time setup

```bash
npm install
npm run predev
```

`predev` pushes the Convex schema, runs the auth setup script (walks you through Resend credential configuration), and opens the Convex dashboard. You'll need a `.env.local` with `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT`.

### Development

```bash
npm run dev
```

Starts the Next.js frontend (with Turbopack) and the Convex backend in parallel. The Convex dev process watches `convex/` and auto-pushes changes.

### Other commands

```bash
npm run build    # Production build
npm run lint     # ESLint
npm run typecheck
npm test         # Vitest + convex-test
npm run check    # lint + typecheck + tests
```

## Project Structure

```
app/
  (splash)/          # Public landing page
  signin/            # Sign-in page (magic link)
  product/           # All authenticated routes
    hackathons/      # Event directory
    h/[hackathonSlug]/ # Event-scoped routes
    ideas/           # Current-event compatibility routes
    ideas/new/       # Create idea
    ideas/[id]/      # Idea detail
    ideas/[id]/edit/ # Edit idea
    activity/        # My Activity dashboard
    notifications/   # User notifications
    onboarding/      # Post-signup profile setup
    settings/        # User settings
proxy.ts             # Auth/admin route gate for /product/*

convex/
  schema.ts          # Database tables and indexes
  auth.ts            # Auth provider (Resend magic link)
  ideas.ts           # Idea CRUD + queries
  comments.ts        # Threaded comments with @mentions
  interest.ts        # Express/remove interest
  memberships.ts     # Join/leave teams
  reactions.ts       # Toggle reactions
  resourceRequests.ts# Resource request management
  notifications.ts   # Notification creation + queries
  users.ts           # User queries + profile management
  hackathons.ts      # Event lifecycle and configuration cloning
  migrations.ts      # Batched, resumable data migrations
  lib.ts             # Shared helpers (auth, validation, sanitization)
  _generated/        # Auto-generated Convex API (do not edit)

components/
  AppShell.tsx       # Sidebar layout + nav + auth gate
  IdeaMasonryItem.tsx# Browse-grid idea item
  IdeaExpandedRow.tsx# Expanded/list idea row
  IdeaForm.tsx       # Shared create/edit form
  ConvexClientProvider.tsx
  ThemeToggle.tsx
  ui/                # shadcn/ui components

lib/
  constants.ts       # Statuses, roles, resource tags, reaction types, labels, colors
  types.ts           # TypeScript types for idea lists, details, comments, etc.
  utils.ts           # cn() utility
```

## Auth & Security

- Access is restricted to the configured `ALLOWED_DOMAIN` (and optional `ALLOWED_EMAILS` whitelist). Enforced server-side in every Convex query and mutation via `getAuthenticatedUser` (`convex/lib.ts`).
- The `list` query returns empty for unauthenticated or unauthorized users.
- Inputs are validated server-side with length, enum, scope, and cross-reference checks; user text is rendered through React rather than injected as HTML.
- Owners can only edit/delete their own ideas. Comment authors can only edit their own comments. Idea owners can delete comments on their ideas.
- `proxy.ts` ensures `/product/*` routes require authentication and protects both global and event-scoped admin paths.
- Participant-facing event mutations require a completed participant profile for that event. Event IDs and cross-document references are validated server-side.
- Completed and archived hackathons reject participant mutations; admin lifecycle functions handle explicit status transitions.

## Disclaimer

**Fikra is not a SaaS product.** It's a self-hosted, single-tenant app designed to be deployed by teams inside their own organization. There is no multi-tenancy, no billing, and no hosted version — and that's intentional.

The app is designed for a single organization and is easy to fork, customize, and deploy for an internal event program.

### Deploying for your team

1. Set up a Convex deployment
2. Configure the `ALLOWED_DOMAIN` environment variable in your Convex deployment to your company's email domain (e.g. `yourcompany.com`)
3. Optionally set `ALLOWED_EMAILS` for a comma-separated whitelist of specific addresses
4. Anyone outside your domain or whitelist will be denied access — enforced server-side on every request

That's it. No user management, no invite flows — if you have a `@yourcompany.com` email, you're in.

## License

[MIT](LICENSE) — do whatever you want with it.
