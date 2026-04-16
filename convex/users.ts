import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  getAuthenticatedUser,
  generateUniqueHandle,
  validateRoleSlugs,
} from "./lib";
import type { Doc } from "./_generated/dataModel";

function pickPublicFields(user: Doc<"users">) {
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    image: user.image,
    roles: user.roles,
    handle: user.handle,
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
    firstName: v.string(),
    lastName: v.string(),
    roles: v.array(v.string()),
  },
  handler: async (ctx, { firstName, lastName, roles }) => {
    const { userId, user } = await getAuthenticatedUser(ctx);
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
    await validateRoleSlugs(ctx, roles);
    await ctx.db.patch(userId, {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      roles: roles,
      name: `${trimmedFirst} ${trimmedLast}`.trim(),
      onboardingComplete: true,
      handle,
    });
  },
});

export const getProfile = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    await getAuthenticatedUser(ctx);

    const user = await ctx.db
      .query("users")
      .withIndex("handle", (q) => q.eq("handle", handle))
      .first();
    if (!user || !user.onboardingComplete) return null;

    const ownedIdeas = await ctx.db
      .query("ideas")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    const memberships = await ctx.db
      .query("ideaMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const joinedIdeas = await Promise.all(
      memberships
        .filter((m) => !ownedIdeas.some((o) => o._id === m.ideaId))
        .map(async (m) => {
          const idea = await ctx.db.get(m.ideaId);
          if (!idea) return null;
          return { ...idea, memberRole: m.role };
        }),
    );

    return {
      ...pickPublicFields(user),
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
        .map((i) => ({
          _id: i!._id,
          _creationTime: i!._creationTime,
          title: i!.title,
          pitch: i!.pitch,
          status: i!.status,
          lookingForRoles: i!.lookingForRoles,
          memberRole: i!.memberRole,
        })),
    };
  },
});

export const listAll = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await getAuthenticatedUser(ctx);

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
    firstName: v.string(),
    lastName: v.string(),
    roles: v.array(v.string()),
  },
  handler: async (ctx, { firstName, lastName, roles }) => {
    const { userId } = await getAuthenticatedUser(ctx);
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
    await validateRoleSlugs(ctx, roles);
    await ctx.db.patch(userId, {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      roles: roles,
      name: `${trimmedFirst} ${trimmedLast}`.trim(),
    });
  },
});
