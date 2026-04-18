import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { LEGACY_RESOURCE_LABELS } from "../lib/constants";

export {
  STATUSES,
  REACTION_TYPES,
  REACTION_EMOJI,
  STATUS_LABELS,
  STATUS_COLORS,
  PARTICIPATION_MODES,
  PARTICIPATION_MODE_LABELS,
  PARTICIPATION_MODE_COLORS,
  TEAM_SIZES,
  teamSizeFromLegacyNumber,
  maxTeamSize,
  type Status,
  type ReactionType,
  type ParticipationMode,
  type TeamSize,
} from "../lib/constants";

import {
  teamSizeFromLegacyNumber as _teamSizeFromLegacyNumber,
  type TeamSize as _TeamSize,
} from "../lib/constants";

export function resolveTeamSize(idea: {
  teamSize?: _TeamSize;
  teamSizeWanted?: number;
}): _TeamSize {
  if (idea.teamSize) return idea.teamSize;
  return _teamSizeFromLegacyNumber(idea.teamSizeWanted ?? 3);
}

const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN ?? "";

export function isEmailAllowed(email: string): boolean {
  if (ALLOWED_DOMAIN && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`))
    return true;
  const extra = process.env.ALLOWED_EMAILS;
  if (extra) {
    const list = extra.split(",").map((e) => e.trim().toLowerCase());
    if (list.includes(email.toLowerCase())) return true;
  }
  return false;
}

export async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  if (!user.email || !isEmailAllowed(user.email)) {
    throw new Error("Access denied: email address is not allowed");
  }
  return { userId, user };
}

export async function getAdminUser(ctx: QueryCtx | MutationCtx) {
  const { userId, user } = await getAuthenticatedUser(ctx);
  if (!user.isAdmin) throw new Error("Admin access required");
  return { userId, user };
}

export function sanitizeText(text: string): string {
  return text.trim();
}

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type UserDisplayFields = Pick<
  Doc<"users">,
  "name" | "firstName" | "lastName" | "email"
>;

export function getUserDisplayName(
  user: UserDisplayFields | null | undefined,
  fallback = "Unknown",
): string {
  if (!user) return fallback;

  const trimmedName = user.name?.trim();
  if (trimmedName) return trimmedName;

  const fullName = [user.firstName?.trim(), user.lastName?.trim()]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  if (fullName) return fullName;

  const trimmedEmail = user.email?.trim();
  if (trimmedEmail) return trimmedEmail;

  return fallback;
}

export function normalizeOptionalStringArray(
  values: string[] | undefined,
): string[] | undefined {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized.length > 0 ? normalized : undefined;
}

export function mergeUniqueStringArrays(
  ...arrays: Array<string[] | undefined>
): string[] | undefined {
  const merged: string[] = [];
  for (const array of arrays) {
    if (!array) continue;
    merged.push(...array);
  }
  return normalizeOptionalStringArray(merged);
}

export function validateStringLength(
  value: string,
  min: number,
  max: number,
  fieldName: string,
): string {
  const trimmed = value.trim();
  if (trimmed.length < min)
    throw new Error(`${fieldName} must be at least ${min} characters`);
  if (trimmed.length > max)
    throw new Error(`${fieldName} must be at most ${max} characters`);
  return trimmed;
}

export async function validateRoleSlugs(
  ctx: QueryCtx | MutationCtx,
  roles: string[],
): Promise<void> {
  if (roles.length === 0) return;
  const allRoles = await ctx.db.query("roles").collect();
  const validSlugs = new Set<string>();
  for (const role of allRoles) {
    validSlugs.add(role.slug);
    if (role.aliasSlugs) {
      for (const alias of role.aliasSlugs) {
        validSlugs.add(alias);
      }
    }
  }
  const invalid = roles.filter((s) => !validSlugs.has(s));
  if (invalid.length > 0) {
    throw new Error(`Invalid role(s): ${invalid.join(", ")}`);
  }
}

export async function validateRoleSlug(
  ctx: QueryCtx | MutationCtx,
  slug: string,
): Promise<void> {
  const existing = await ctx.db
    .query("roles")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (existing) return;
  const allRoles = await ctx.db.query("roles").collect();
  const found = allRoles.some((r) => r.aliasSlugs?.includes(slug));
  if (!found) {
    throw new Error(`Invalid role: ${slug}`);
  }
}

export async function validateResourceSlugs(
  ctx: QueryCtx | MutationCtx,
  slugs: string[],
): Promise<void> {
  if (slugs.length === 0) return;

  const resources = await ctx.db.query("resources").collect();
  const validSlugs = new Set(resources.map((resource) => resource.slug));
  const invalid = slugs.filter((slug) => !validSlugs.has(slug));

  if (invalid.length > 0) {
    throw new Error(`Invalid resource(s): ${invalid.join(", ")}`);
  }
}

export async function getResourceNameMap(
  ctx: QueryCtx | MutationCtx,
): Promise<Record<string, string>> {
  const resources = await ctx.db.query("resources").collect();
  const map: Record<string, string> = {
    ...LEGACY_RESOURCE_LABELS,
  };

  for (const resource of resources) {
    map[resource.slug] = resource.name;
  }

  return map;
}

export async function generateUniqueHandle(
  ctx: QueryCtx | MutationCtx,
  email: string,
  excludeUserId?: Id<"users">,
): Promise<string | undefined> {
  const base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  if (!base) return undefined;

  let candidate = base;
  let suffix = 1;
  for (;;) {
    const existing = await ctx.db
      .query("users")
      .withIndex("handle", (q) => q.eq("handle", candidate))
      .first();
    if (!existing || existing._id === excludeUserId) return candidate;
    suffix++;
    candidate = `${base}${suffix}`;
  }
}
