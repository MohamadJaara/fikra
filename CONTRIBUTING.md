# Contributing to Fikra

Thanks for your interest in contributing to Fikra. This document covers the basics of setting up the project and submitting changes.

## Setup

1. **Prerequisites**: Node.js 18+ and a [Convex](https://convex.dev) account.
2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **First-time setup**:

   ```bash
   npm run predev
   ```

   This pushes the Convex schema, runs the auth setup script (walks you through Resend credentials), and opens the Convex dashboard. You'll need a `.env.local` with `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT`.

4. **Start developing**:

   ```bash
   npm run dev
   ```

   Starts Next.js (Turbopack) and the Convex backend in parallel.

## Project Overview

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui (new-york style)
- **Backend**: Convex (database, server functions, real-time subscriptions)
- **Auth**: Convex Auth with Resend magic link
- **Language**: TypeScript (strict mode)

See [AGENTS.md](./AGENTS.md) for a detailed architecture breakdown.

## Making Changes

### Code Style

- **Formatter**: Prettier with default settings. Run `npx prettier --write .` before committing.
- **Linting**: `npm run lint` (ESLint with `next/core-web-vitals` + `next/typescript`).
- **Comments**: Keep code self-documenting. Only add comments where the "why" is non-obvious.

### Conventions

- **Convex functions**: Live in `convex/`. Never edit files in `convex/_generated/`.
- **UI components**: Use shadcn/ui. Add new components with `npx shadcn@latest add <component>`.
- **Constants**: Domain enums (statuses, roles, resource tags, etc.) go in `lib/constants.ts`.
- **Types**: Shared TypeScript types go in `lib/types.ts`.
- **Path alias**: `@/*` maps to the repo root.

### Commits

Use clear, descriptive commit messages. There's no strict convention — just make sure the message explains the intent of the change.

## Submitting Changes

1. Fork the repository.
2. Create a branch from `main`: `git checkout -b my-feature`.
3. Make your changes and commit.
4. Push to your fork and open a pull request against `main`.
5. Describe what the PR does and why. Reference any related issues.

### AI-Generated Contributions

If your contribution was generated with an AI tool (e.g. Copilot, Cursor, ChatGPT, Claude, etc.), please include the prompt you used in your PR description. This helps reviewers understand the intent and verify the output.

Even easier — you can [open an issue](https://github.com/MohamadJaara/fikra/issues/new/choose) with the prompt describing what you'd like to see built, and I'll gladly run it myself.

### Pull Request Checklist

- [ ] `npm run lint` passes with no errors.
- [ ] `npm run build` succeeds.
- [ ] Changes have been manually tested via `npm run dev`.

## Reporting Issues

- **Bug reports** and **feature requests**: Use the [GitHub issue templates](https://github.com/MohamadJaara/fikra/issues/new/choose).
- **Questions or discussions**: Use [GitHub Discussions](https://github.com/MohamadJaara/fikra/discussions).

## Security

See [SECURITY.md](./SECURITY.md) for reporting security vulnerabilities.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
