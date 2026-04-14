# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Fikra, please **do not** open a public issue. Instead, report it privately:

1. Go to [GitHub Security Advisories](https://github.com/MohamadJaara/fikra/security/advisories/new).
2. Submit a private vulnerability report with a clear description of the issue, steps to reproduce, and any relevant details (affected versions, proof of concept, etc.).

We'll acknowledge your report within **48 hours** and aim to provide an initial assessment within **5 business days**.

## What to Report

- Authentication or authorization bypasses
- Server-side or stored input injection (XSS, etc.)
- Exposure of sensitive data (credentials, tokens, user data)
- Any flaw that could compromise the integrity or availability of the app

## What Not to Report

- Issues already reported by someone else
- Theoretical risks without a demonstrable attack vector
- Denial-of-service via resource exhaustion (Fikra is self-hosted — this is your infrastructure)
- Findings from automated scanners without manual verification

## Scope

Fikra is a **self-hosted, single-tenant** application. Security expectations reflect that context:

- Access is gated by email domain (`ALLOWED_DOMAIN`) and an optional email whitelist (`ALLOWED_EMAILS`), enforced server-side on every Convex function.
- All user input is validated and sanitized server-side (length limits, HTML escaping, enum checks).
- Owners can only modify their own ideas/comments.

Out of scope: your own infrastructure configuration (Convex deployment settings, Resend credentials, hosting provider, etc.).

## Supported Versions

| Version | Supported |
| ------- | --------- |
| main    | Yes       |

Fikra is in early development. We only support the latest version on `main`.

## Disclosure Policy

Once a vulnerability is confirmed and a fix is released, we'll publish a GitHub Security Advisory with credit to the reporter (unless you prefer to remain anonymous).
