import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  getAuthenticatedUser,
  getAdminUser,
  mergeUniqueStringArrays,
  sanitizeText,
} from "./lib";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

const BATCH = 64;

const PHASES = ["users", "ideas", "ideaMembers"] as const;

function nextPhase(p: (typeof PHASES)[number]): (typeof PHASES)[number] | null {
  const i = PHASES.indexOf(p);
  return i < PHASES.length - 1 ? PHASES[i + 1] : null;
}

export const batchMigrateRoleSlug = internalMutation({
  args: {
    roleId: v.id("roles"),
    oldSlug: v.string(),
    newSlug: v.optional(v.string()),
    phase: v.union(
      v.literal("users"),
      v.literal("ideas"),
      v.literal("ideaMembers"),
    ),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const { roleId, oldSlug, newSlug, phase } = args;
    const isRename = newSlug !== undefined;

    const query =
      phase === "users"
        ? ctx.db.query("users")
        : phase === "ideas"
          ? ctx.db.query("ideas")
          : ctx.db.query("ideaMembers");

    const result = await query.paginate({
      cursor: args.cursor,
      numItems: BATCH,
    });

    for (const doc of result.page) {
      if (phase === "users") {
        const roles = (doc as Doc<"users">).roles;
        if (roles?.includes(oldSlug)) {
          await ctx.db.patch(doc._id, {
            roles: isRename
              ? roles.map((r: string) => (r === oldSlug ? newSlug : r))
              : roles.filter((r: string) => r !== oldSlug),
          });
        }
      } else if (phase === "ideas") {
        const lfr = (doc as Doc<"ideas">).lookingForRoles;
        if (lfr?.includes(oldSlug)) {
          await ctx.db.patch(doc._id, {
            lookingForRoles: isRename
              ? lfr.map((r: string) => (r === oldSlug ? newSlug : r))
              : lfr.filter((r: string) => r !== oldSlug),
          });
        }
      } else {
        const membership = doc as Doc<"ideaMembers">;
        const currentRoles =
          mergeUniqueStringArrays(
            membership.memberRoles,
            membership.role ? [membership.role] : undefined,
          ) ?? [];

        if (currentRoles.includes(oldSlug)) {
          const updated = currentRoles.filter((r: string) => r !== oldSlug);
          if (isRename && !updated.includes(newSlug!)) {
            updated.push(newSlug!);
          }
          await ctx.db.patch(doc._id, {
            memberRoles: updated.length > 0 ? updated : undefined,
            role: undefined,
          });
        }
      }
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.roles.batchMigrateRoleSlug, {
        ...args,
        cursor: result.continueCursor,
      });
    } else {
      const next = nextPhase(phase);
      if (next) {
        await ctx.scheduler.runAfter(0, internal.roles.batchMigrateRoleSlug, {
          roleId,
          oldSlug,
          newSlug,
          phase: next,
          cursor: null,
        });
      } else {
        const role = await ctx.db.get(roleId);
        if (role) {
          if (isRename) {
            const remaining = (role.aliasSlugs ?? []).filter(
              (s) => s !== oldSlug,
            );
            await ctx.db.patch(roleId, {
              aliasSlugs: remaining.length > 0 ? remaining : undefined,
            });
          } else {
            await ctx.db.delete(roleId);
          }
        }
      }
    }
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);
    const all = await ctx.db.query("roles").order("asc").collect();
    return all.filter((r) => !r.deletedAt);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);
    const name = sanitizeText(args.name);
    if (!name) throw new Error("Role name is required");
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^-|-$/g, "");
    const allRoles = await ctx.db.query("roles").collect();
    const conflict = allRoles.find(
      (r) => r.slug === slug || r.aliasSlugs?.includes(slug),
    );
    if (conflict) throw new Error("Role already exists");
    return await ctx.db.insert("roles", { name, slug });
  },
});

export const createMany = mutation({
  args: {
    names: v.string(),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);
    const items = args.names
      .split(",")
      .map((s) => sanitizeText(s))
      .filter(Boolean);
    if (items.length === 0) throw new Error("No valid names provided");
    const created: string[] = [];
    const skipped: string[] = [];
    const allRoles = await ctx.db.query("roles").collect();
    for (const name of items) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^-|-$/g, "");
      const conflict = allRoles.find(
        (r) => r.slug === slug || r.aliasSlugs?.includes(slug),
      );
      if (conflict) {
        skipped.push(name);
      } else {
        const docId = await ctx.db.insert("roles", { name, slug });
        allRoles.push({
          _id: docId,
          _creationTime: Date.now(),
          name,
          slug,
        });
        created.push(name);
      }
    }
    return { created, skipped };
  },
});

export const update = mutation({
  args: {
    roleId: v.id("roles"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);
    const name = sanitizeText(args.name);
    if (!name) throw new Error("Role name is required");
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^-|-$/g, "");
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing && existing._id !== args.roleId) {
      throw new Error("Role already exists");
    }
    if (!existing) {
      const allRoles = await ctx.db.query("roles").collect();
      const aliasConflict = allRoles.find(
        (r) => r.aliasSlugs?.includes(slug) && r._id !== args.roleId,
      );
      if (aliasConflict) throw new Error("Role already exists");
    }
    const oldRole = await ctx.db.get(args.roleId);
    if (!oldRole) throw new Error("Role not found");
    if (oldRole.slug !== slug) {
      await ctx.db.patch(args.roleId, {
        name,
        slug,
        aliasSlugs: [...(oldRole.aliasSlugs ?? []), oldRole.slug],
      });
      await ctx.scheduler.runAfter(0, internal.roles.batchMigrateRoleSlug, {
        roleId: args.roleId,
        oldSlug: oldRole.slug,
        newSlug: slug,
        phase: "users",
        cursor: null,
      });
    } else {
      await ctx.db.patch(args.roleId, { name });
    }
  },
});

export const remove = mutation({
  args: {
    roleId: v.id("roles"),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found");
    await ctx.scheduler.runAfter(0, internal.roles.batchMigrateRoleSlug, {
      roleId: args.roleId,
      oldSlug: role.slug,
      phase: "users",
      cursor: null,
    });
    await ctx.db.patch(args.roleId, { deletedAt: Date.now() });
  },
});
