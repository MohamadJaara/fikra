import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export {
  STATUSES,
  RESOURCE_TAGS,
  REACTION_TYPES,
  REACTION_EMOJI,
  STATUS_LABELS,
  STATUS_COLORS,
  RESOURCE_TAG_LABELS,
  type Status,
  type ResourceTag,
  type ReactionType,
} from "../lib/constants";

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
