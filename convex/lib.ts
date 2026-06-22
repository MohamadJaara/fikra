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

export function isEffectiveIdeaMember(
  member: Pick<Doc<"ideaMembers">, "userId" | "joinedAsOwner">,
  idea: Pick<Doc<"ideas">, "ownerId">,
): boolean {
  return member.userId !== idea.ownerId || member.joinedAsOwner === true;
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

export const HACKATHON_STATUSES = [
  "draft",
  "upcoming",
  "active",
  "completed",
  "archived",
] as const;
export type HackathonStatus = (typeof HACKATHON_STATUSES)[number];

export const PLATFORM_SETTING_KEY = "main";

export async function getCurrentHackathon(ctx: QueryCtx | MutationCtx) {
  const setting = await ctx.db
    .query("platformSettings")
    .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTING_KEY))
    .unique();

  if (setting?.currentHackathonId) {
    const current = await ctx.db.get(setting.currentHackathonId);
    if (current && current.status !== "archived") return current;
  }

  const active = await ctx.db
    .query("hackathons")
    .withIndex("by_status_and_startsAt", (q) => q.eq("status", "active"))
    .order("desc")
    .first();
  if (active) return active;

  return await ctx.db
    .query("hackathons")
    .withIndex("by_startsAt")
    .order("desc")
    .first();
}

export async function getHackathonByIdOrCurrent(
  ctx: QueryCtx | MutationCtx,
  hackathonId?: Id<"hackathons">,
) {
  if (hackathonId) {
    const hackathon = await ctx.db.get(hackathonId);
    if (!hackathon) throw new Error("Hackathon not found");
    return hackathon;
  }
  return await getCurrentHackathon(ctx);
}

export async function getParticipant(
  ctx: QueryCtx | MutationCtx,
  hackathonId: Id<"hackathons">,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("hackathonParticipants")
    .withIndex("by_hackathon_and_user", (q) =>
      q.eq("hackathonId", hackathonId).eq("userId", userId),
    )
    .unique();
}

export async function requireParticipant(
  ctx: QueryCtx | MutationCtx,
  hackathonId: Id<"hackathons">,
  userId: Id<"users">,
) {
  const participant = await getParticipant(ctx, hackathonId, userId);
  if (!participant) {
    throw new Error("Complete your hackathon profile before continuing");
  }
  if (!participant.onboardingComplete) {
    throw new Error("Complete your hackathon profile before continuing");
  }
  return participant;
}

export async function assertHackathonWritable(
  ctx: QueryCtx | MutationCtx,
  hackathonId: Id<"hackathons"> | undefined,
  user?: Pick<Doc<"users">, "isAdmin">,
) {
  if (!hackathonId) return;
  const hackathon = await ctx.db.get(hackathonId);
  if (!hackathon) throw new Error("Hackathon not found");
  if (
    !user?.isAdmin &&
    (hackathon.status === "completed" || hackathon.status === "archived")
  ) {
    throw new Error("This hackathon is read-only");
  }
  return hackathon;
}

export async function assertIdeaInHackathon(
  ctx: QueryCtx | MutationCtx,
  idea: Pick<Doc<"ideas">, "hackathonId">,
  hackathonId: Id<"hackathons"> | undefined,
) {
  if (!hackathonId || !idea.hackathonId) return;
  if (idea.hackathonId !== hackathonId) {
    throw new Error("Idea does not belong to this hackathon");
  }
}

export function resolveScopedHackathonId<T extends { hackathonId?: Id<"hackathons"> }>(
  doc: T,
  fallback?: Id<"hackathons">,
) {
  return doc.hackathonId ?? fallback;
}

export async function isVotingActive(
  ctx: QueryCtx | MutationCtx,
  hackathonId?: Id<"hackathons">,
) {
  const effectiveHackathonId =
    hackathonId ?? (await getCurrentHackathon(ctx))?._id;
  const setting = effectiveHackathonId
    ? await ctx.db
        .query("votingSettings")
        .withIndex("by_hackathon_and_key", (q) =>
          q.eq("hackathonId", effectiveHackathonId).eq("key", "main"),
        )
        .unique()
    : await ctx.db
        .query("votingSettings")
        .withIndex("by_key", (q) => q.eq("key", "main"))
        .unique();
  return setting?.active === true;
}

export async function assertIdeasUnlocked(
  ctx: QueryCtx | MutationCtx,
  hackathonId?: Id<"hackathons">,
) {
  if (await isVotingActive(ctx, hackathonId)) {
    throw new Error(
      "Voting is active. Ideas are only available from the voting page.",
    );
  }
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
  hackathonId?: Id<"hackathons">,
): Promise<void> {
  if (roles.length === 0) return;
  const effectiveHackathonId =
    hackathonId ?? (await getCurrentHackathon(ctx))?._id;
  const allRoles = effectiveHackathonId
    ? [
        ...(await ctx.db
          .query("roles")
          .withIndex("by_hackathon", (q) =>
            q.eq("hackathonId", effectiveHackathonId),
          )
          .collect()),
        ...(await ctx.db
          .query("roles")
          .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
          .collect()),
      ]
    : await ctx.db.query("roles").collect();
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
  hackathonId?: Id<"hackathons">,
): Promise<void> {
  const effectiveHackathonId =
    hackathonId ?? (await getCurrentHackathon(ctx))?._id;
  const existing = effectiveHackathonId
    ? await ctx.db
        .query("roles")
        .withIndex("by_hackathon_and_slug", (q) =>
          q.eq("hackathonId", effectiveHackathonId).eq("slug", slug),
        )
        .first()
    : await ctx.db
        .query("roles")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
  if (existing) return;
  const allRoles = effectiveHackathonId
    ? [
        ...(await ctx.db
          .query("roles")
          .withIndex("by_hackathon", (q) =>
            q.eq("hackathonId", effectiveHackathonId),
          )
          .collect()),
        ...(await ctx.db
          .query("roles")
          .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
          .collect()),
      ]
    : await ctx.db.query("roles").collect();
  const found = allRoles.some((r) => r.aliasSlugs?.includes(slug));
  if (!found) {
    throw new Error(`Invalid role: ${slug}`);
  }
}

export async function validateResourceSlugs(
  ctx: QueryCtx | MutationCtx,
  slugs: string[],
  hackathonId?: Id<"hackathons">,
): Promise<void> {
  if (slugs.length === 0) return;

  const effectiveHackathonId =
    hackathonId ?? (await getCurrentHackathon(ctx))?._id;
  const resources = effectiveHackathonId
    ? [
        ...(await ctx.db
          .query("resources")
          .withIndex("by_hackathon", (q) =>
            q.eq("hackathonId", effectiveHackathonId),
          )
          .collect()),
        ...(await ctx.db
          .query("resources")
          .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
          .collect()),
      ]
    : await ctx.db.query("resources").collect();
  const validSlugs = new Set(resources.map((resource) => resource.slug));
  const invalid = slugs.filter((slug) => !validSlugs.has(slug));

  if (invalid.length > 0) {
    throw new Error(`Invalid resource(s): ${invalid.join(", ")}`);
  }
}

export async function getResourceNameMap(
  ctx: QueryCtx | MutationCtx,
  hackathonId?: Id<"hackathons">,
): Promise<Record<string, string>> {
  const effectiveHackathonId =
    hackathonId ?? (await getCurrentHackathon(ctx))?._id;
  const resources = effectiveHackathonId
    ? [
        ...(await ctx.db
          .query("resources")
          .withIndex("by_hackathon", (q) =>
            q.eq("hackathonId", effectiveHackathonId),
          )
          .collect()),
        ...(await ctx.db
          .query("resources")
          .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
          .collect()),
      ]
    : await ctx.db.query("resources").collect();
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
