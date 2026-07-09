import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  assertHackathonWritable,
  canReadLegacyScope,
  getAuthenticatedUser,
  generateUniqueHandle,
  getHackathonByIdOrCurrent,
  getParticipant,
  getUserDisplayName,
  isEffectiveIdeaMember,
  mergeUniqueStringArrays,
  requireParticipant,
  requireStoredParticipant,
  validateRoleSlugs,
  PARTICIPATION_MODES,
  isEmailAllowed,
} from "./lib";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const MAX_PROFILE_IDEAS = 50;
// TEMPORARY MIGRATION COMPATIBILITY: cap each scoped/legacy membership read.
const MAX_PROFILE_MEMBERSHIPS_PER_SCOPE = 100;

async function upsertHackathonParticipant(
  ctx: MutationCtx,
  hackathonId: Id<"hackathons">,
  userId: Id<"users">,
  values: {
    roles: string[];
    participationMode?: string;
  },
) {
  const existing = await ctx.db
    .query("hackathonParticipants")
    .withIndex("by_hackathon_and_user", (q) =>
      q.eq("hackathonId", hackathonId).eq("userId", userId),
    )
    .unique();
  const now = Date.now();
  const participationMode =
    values.participationMode === "onsite" ||
    values.participationMode === "remote"
      ? values.participationMode
      : undefined;
  if (existing) {
    await ctx.db.patch(existing._id, {
      roles: values.roles,
      participationMode,
      onboardingComplete: true,
      updatedAt: now,
    });
    return;
  }
  await ctx.db.insert("hackathonParticipants", {
    hackathonId,
    userId,
    roles: values.roles,
    participationMode,
    onboardingComplete: true,
    registeredAt: now,
    updatedAt: now,
  });
}

function pickPublicFields(user: Doc<"users">) {
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    name: getUserDisplayName(user, ""),
    firstName: user.firstName,
    lastName: user.lastName,
    image: user.image,
    roles: user.roles,
    handle: user.handle,
    participationMode: user.participationMode,
  };
}

function pickViewerFields(user: Doc<"users">) {
  return {
    ...pickPublicFields(user),
    email: user.email,
    onboardingComplete: user.onboardingComplete,
    isAdmin: user.isAdmin,
  };
}

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await getAuthenticatedUser(ctx);
    return pickViewerFields(user);
  },
});

export const viewerOrNull = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user?.email || !isEmailAllowed(user.email)) return null;

    return pickViewerFields(user);
  },
});

export const getMyParticipation = query({
  args: { hackathonId: v.id("hackathons") },
  handler: async (ctx, { hackathonId }) => {
    const { userId, user } = await getAuthenticatedUser(ctx);
    const participant = await getParticipant(ctx, hackathonId, userId);
    if (!participant) {
      const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
      if (
        !hackathon ||
        hackathon.status === "archived" ||
        !user.onboardingComplete ||
        !(await canReadLegacyScope(ctx, hackathon._id))
      ) {
        return null;
      }
      return {
        hackathonId: hackathon._id,
        roles: user.roles,
        participationMode: user.participationMode,
        onboardingComplete: true,
        legacyFallback: true as const,
      };
    }

    return {
      _id: participant._id,
      hackathonId: participant.hackathonId,
      roles: participant.roles ?? user.roles,
      participationMode:
        participant.participationMode ?? user.participationMode,
      onboardingComplete: participant.onboardingComplete,
      availabilityNote: participant.availabilityNote,
    };
  },
});

export const getMany = query({
  args: { ids: v.array(v.id("users")) },
  handler: async (ctx, { ids }) => {
    await getAuthenticatedUser(ctx);
    const results = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return results.filter((u) => u !== null).map(pickPublicFields);
  },
});

export const getOne = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    await getAuthenticatedUser(ctx);
    const user = await ctx.db.get(id);
    return user ? pickPublicFields(user) : null;
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, { query: q }) => {
    await getAuthenticatedUser(ctx);
    const trimmed = q.trim();
    if (trimmed.length === 0) return [];

    const [byName, byHandle] = await Promise.all([
      ctx.db
        .query("users")
        .withSearchIndex("search_name", (s) =>
          s.search("name", trimmed).eq("onboardingComplete", true),
        )
        .take(10),
      ctx.db
        .query("users")
        .withSearchIndex("search_handle", (s) =>
          s.search("handle", trimmed).eq("onboardingComplete", true),
        )
        .take(10),
    ]);

    const seen = new Set();
    const merged = [...byName, ...byHandle].filter((u) => {
      if (seen.has(u._id)) return false;
      seen.add(u._id);
      return true;
    });

    return merged.slice(0, 10).map(pickPublicFields);
  },
});

export const completeOnboarding = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    firstName: v.string(),
    lastName: v.string(),
    roles: v.array(v.string()),
    participationMode: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { firstName, lastName, roles, participationMode, hackathonId },
  ) => {
    const { userId, user } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    if (!hackathon) throw new Error("Hackathon not found");
    await assertHackathonWritable(ctx, hackathon._id);
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (trimmedFirst.length === 0) {
      throw new Error("First name is required");
    }
    if (trimmedFirst.length > 100) {
      throw new Error("First name must be at most 100 characters");
    }
    if (trimmedLast.length > 100) {
      throw new Error("Last name must be at most 100 characters");
    }
    const handle = user.email
      ? await generateUniqueHandle(ctx, user.email, userId)
      : undefined;
    await validateRoleSlugs(ctx, roles, hackathon._id);
    if (
      participationMode !== undefined &&
      !PARTICIPATION_MODES.includes(
        participationMode as (typeof PARTICIPATION_MODES)[number],
      )
    ) {
      throw new Error("Invalid participation mode");
    }
    await ctx.db.patch(userId, {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      name: `${trimmedFirst} ${trimmedLast}`.trim(),
      onboardingComplete: true,
      handle,
    });
    await upsertHackathonParticipant(ctx, hackathon._id, userId, {
      roles,
      participationMode,
    });
  },
});

export const getProfile = query({
  args: { handle: v.string(), hackathonId: v.id("hackathons") },
  handler: async (ctx, { handle, hackathonId }) => {
    const { userId: viewerId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    if (!hackathon) return null;
    await requireParticipant(ctx, hackathon._id, viewerId);

    const user = await ctx.db
      .query("users")
      .withIndex("handle", (q) => q.eq("handle", handle))
      .first();
    if (!user || !user.onboardingComplete) return null;
    const [targetParticipant, includeLegacy] = await Promise.all([
      getParticipant(ctx, hackathon._id, user._id),
      canReadLegacyScope(ctx, hackathon._id),
    ]);
    if (
      (targetParticipant && targetParticipant.onboardingComplete !== true) ||
      (!targetParticipant && !includeLegacy)
    ) {
      return null;
    }

    const [
      scopedOwnedIdeas,
      legacyOwnedIdeas,
      scopedMemberships,
      legacyMemberships,
    ] = await Promise.all([
      ctx.db
        .query("ideas")
        .withIndex("by_hackathon_and_owner", (q) =>
          q.eq("hackathonId", hackathon._id).eq("ownerId", user._id),
        )
        .order("desc")
        .take(MAX_PROFILE_IDEAS),
      includeLegacy
        ? ctx.db
            .query("ideas")
            .withIndex("by_hackathon_and_owner", (q) =>
              q.eq("hackathonId", undefined).eq("ownerId", user._id),
            )
            .order("desc")
            .take(MAX_PROFILE_IDEAS)
        : Promise.resolve([]),
      ctx.db
        .query("ideaMembers")
        .withIndex("by_hackathon_and_user", (q) =>
          q.eq("hackathonId", hackathon._id).eq("userId", user._id),
        )
        .order("desc")
        .take(MAX_PROFILE_MEMBERSHIPS_PER_SCOPE),
      includeLegacy
        ? ctx.db
            .query("ideaMembers")
            .withIndex("by_hackathon_and_user", (q) =>
              q.eq("hackathonId", undefined).eq("userId", user._id),
            )
            .order("desc")
            .take(MAX_PROFILE_MEMBERSHIPS_PER_SCOPE)
        : Promise.resolve([]),
    ]);
    const ownedIdeas = [...scopedOwnedIdeas, ...legacyOwnedIdeas]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, MAX_PROFILE_IDEAS);
    const memberships = [...scopedMemberships, ...legacyMemberships];

    const joinedIdeas = await Promise.all(
      memberships.map(async (m) => {
        const idea = await ctx.db.get(m.ideaId);
        if (
          !idea ||
          (idea.hackathonId !== hackathon._id &&
            !(includeLegacy && idea.hackathonId === undefined)) ||
          !isEffectiveIdeaMember(m, idea)
        ) {
          return null;
        }
        return {
          ...idea,
          memberRoles: mergeUniqueStringArrays(
            m.memberRoles,
            m.role ? [m.role] : undefined,
          ),
        };
      }),
    );

    return {
      ...pickPublicFields(user),
      roles: targetParticipant?.roles ?? user.roles,
      participationMode: targetParticipant
        ? (targetParticipant.participationMode ?? user.participationMode)
        : user.participationMode,
      ownedIdeas: ownedIdeas.map((i) => ({
        _id: i._id,
        _creationTime: i._creationTime,
        title: i.title,
        pitch: i.pitch,
        status: i.status,
        lookingForRoles: i.lookingForRoles,
      })),
      joinedIdeas: joinedIdeas
        .filter((i) => i !== null)
        .filter(
          (idea, index, all) =>
            all.findIndex((candidate) => candidate?._id === idea?._id) ===
            index,
        )
        .slice(0, MAX_PROFILE_IDEAS)
        .map((i) => ({
          _id: i!._id,
          _creationTime: i!._creationTime,
          title: i!.title,
          pitch: i!.pitch,
          status: i!.status,
          lookingForRoles: i!.lookingForRoles,
          memberRoles: i!.memberRoles,
        })),
    };
  },
});

export const listAll = query({
  args: {
    hackathonId: v.optional(v.id("hackathons")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { hackathonId, paginationOpts }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);

    if (hackathon) {
      await requireParticipant(ctx, hackathon._id, userId);
      const result = await ctx.db
        .query("hackathonParticipants")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", hackathon._id))
        .paginate(paginationOpts);

      const page = await Promise.all(
        result.page.map(async (participant) => {
          if (participant.onboardingComplete !== true) return null;
          const user = await ctx.db.get(participant.userId);
          if (!user || !user.onboardingComplete) return null;
          return {
            ...pickPublicFields(user),
            roles: participant.roles ?? user.roles,
            participationMode:
              participant.participationMode ?? user.participationMode,
          };
        }),
      );

      return {
        ...result,
        page: page.filter((user) => user !== null),
      };
    }

    const result = await ctx.db
      .query("users")
      .withIndex("by_onboardingComplete", (q) =>
        q.eq("onboardingComplete", true),
      )
      .paginate(paginationOpts);

    return {
      ...result,
      page: result.page.map(pickPublicFields),
    };
  },
});

export const updateProfile = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    firstName: v.string(),
    lastName: v.string(),
    roles: v.array(v.string()),
    participationMode: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { firstName, lastName, roles, participationMode, hackathonId },
  ) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    if (!hackathon) throw new Error("Hackathon not found");
    await assertHackathonWritable(ctx, hackathon._id);
    const participant = await requireStoredParticipant(
      ctx,
      hackathon._id,
      userId,
    );
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (trimmedFirst.length === 0) {
      throw new Error("First name is required");
    }
    if (trimmedFirst.length > 100) {
      throw new Error("First name must be at most 100 characters");
    }
    if (trimmedLast.length > 100) {
      throw new Error("Last name must be at most 100 characters");
    }
    await validateRoleSlugs(ctx, roles, hackathon._id);
    if (
      participationMode !== undefined &&
      !PARTICIPATION_MODES.includes(
        participationMode as (typeof PARTICIPATION_MODES)[number],
      )
    ) {
      throw new Error("Invalid participation mode");
    }
    await ctx.db.patch(userId, {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      name: `${trimmedFirst} ${trimmedLast}`.trim(),
    });
    await ctx.db.patch(participant._id, {
      roles,
      participationMode:
        participationMode === "onsite" || participationMode === "remote"
          ? participationMode
          : undefined,
      updatedAt: Date.now(),
    });
  },
});

export const setParticipationMode = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    mode: v.optional(v.string()),
  },
  handler: async (ctx, { mode, hackathonId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    if (!hackathon) throw new Error("Hackathon not found");
    await assertHackathonWritable(ctx, hackathon._id);
    const participant = await requireStoredParticipant(
      ctx,
      hackathon._id,
      userId,
    );
    if (
      mode !== undefined &&
      !PARTICIPATION_MODES.includes(
        mode as (typeof PARTICIPATION_MODES)[number],
      )
    ) {
      throw new Error("Invalid participation mode");
    }
    await ctx.db.patch(participant._id, {
      participationMode:
        mode === "onsite" || mode === "remote" ? mode : undefined,
      updatedAt: Date.now(),
    });
  },
});
