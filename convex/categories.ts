import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  assertHackathonWritable,
  getAuthenticatedUser,
  getAdminUser,
  getHackathonByIdOrCurrent,
  sanitizeText,
} from "./lib";
import type { Id } from "./_generated/dataModel";

function createCategorySlug(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) {
    throw new Error(
      "Category name must include at least one English letter or number",
    );
  }

  return slug;
}

export const list = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const categories = await getScopedCategories(ctx, hackathon?._id);
    return categories.sort(
      (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity),
    );
  },
});

export const listWithDetails = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const categories = await getScopedCategories(ctx, hackathon?._id);
    const sorted = categories.sort(
      (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity),
    );
    const ideas = hackathon
      ? await ctx.db
          .query("ideas")
          .withIndex("by_hackathon", (q) => q.eq("hackathonId", hackathon._id))
          .collect()
      : await ctx.db.query("ideas").collect();

    const countByCategory: Record<string, number> = {};
    for (const idea of ideas) {
      if (idea.categoryId) {
        const id = idea.categoryId;
        countByCategory[id] = (countByCategory[id] || 0) + 1;
      }
    }

    return await Promise.all(
      sorted.map(async (cat) => {
        const imageUrl = cat.imageId
          ? await ctx.storage.getUrl(cat.imageId)
          : null;
        return {
          ...cat,
          imageUrl,
          ideaCount: countByCategory[cat._id] || 0,
        };
      }),
    );
  },
});

export const getBySlug = query({
  args: { slug: v.string(), hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { slug, hackathonId }) => {
    await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const category = hackathon
      ? (await ctx.db
          .query("categories")
          .withIndex("by_hackathon_and_slug", (q) =>
            q.eq("hackathonId", hackathon._id).eq("slug", slug),
          )
          .first()) ??
        (await ctx.db
          .query("categories")
          .withIndex("by_hackathon_and_slug", (q) =>
            q.eq("hackathonId", undefined).eq("slug", slug),
          )
          .first())
      : await ctx.db
          .query("categories")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .unique();
    if (!category) return null;
    const imageUrl = category.imageId
      ? await ctx.storage.getUrl(category.imageId)
      : null;
    return { ...category, imageUrl };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    hackathonId: v.optional(v.id("hackathons")),
    name: v.string(),
    description: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { user } = await getAdminUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, args.hackathonId);
    await assertHackathonWritable(ctx, hackathon?._id, user);
    const name = sanitizeText(args.name);
    if (!name) throw new Error("Category name is required");
    const slug = createCategorySlug(name);
    const existing = hackathon
      ? await ctx.db
          .query("categories")
          .withIndex("by_hackathon_and_slug", (q) =>
            q.eq("hackathonId", hackathon._id).eq("slug", slug),
          )
          .first()
      : await ctx.db
          .query("categories")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .first();
    if (existing) throw new Error("Category already exists");
    const description = args.description
      ? sanitizeText(args.description)
      : undefined;
    return await ctx.db.insert("categories", {
      hackathonId: hackathon?._id,
      name,
      slug,
      description,
      imageId: args.imageId,
      order: Date.now(),
    });
  },
});

export const createMany = mutation({
  args: {
    hackathonId: v.optional(v.id("hackathons")),
    names: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAdminUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, args.hackathonId);
    await assertHackathonWritable(ctx, hackathon?._id, user);
    const items = args.names
      .split(",")
      .map((s) => sanitizeText(s))
      .filter(Boolean);
    if (items.length === 0) throw new Error("No valid names provided");
    const created: string[] = [];
    const skipped: string[] = [];
    for (const name of items) {
      const slug = createCategorySlug(name);
      const existing = hackathon
        ? await ctx.db
            .query("categories")
            .withIndex("by_hackathon_and_slug", (q) =>
              q.eq("hackathonId", hackathon._id).eq("slug", slug),
            )
            .first()
        : await ctx.db
            .query("categories")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .first();
      if (existing) {
        skipped.push(name);
      } else {
        await ctx.db.insert("categories", {
          hackathonId: hackathon?._id,
          name,
          slug,
          order: Date.now(),
        });
        created.push(name);
      }
    }
    return { created, skipped };
  },
});

export const update = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
    description: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { user } = await getAdminUser(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      if (args.imageId) {
        await ctx.storage.delete(args.imageId);
      }
      throw new Error("Category not found");
    }
    await assertHackathonWritable(ctx, category.hackathonId, user);
    const cleanupReplacementImage = async () => {
      if (args.imageId && args.imageId !== category.imageId) {
        await ctx.storage.delete(args.imageId);
      }
    };
    const name = sanitizeText(args.name);
    if (!name) {
      await cleanupReplacementImage();
      throw new Error("Category name is required");
    }
    let slug: string;
    try {
      slug = createCategorySlug(name);
    } catch (error) {
      await cleanupReplacementImage();
      throw error;
    }
    const existing = category.hackathonId
      ? await ctx.db
          .query("categories")
          .withIndex("by_hackathon_and_slug", (q) =>
            q.eq("hackathonId", category.hackathonId).eq("slug", slug),
          )
          .first()
      : await ctx.db
          .query("categories")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .first();
    if (existing && existing._id !== args.categoryId) {
      await cleanupReplacementImage();
      throw new Error("Category already exists");
    }
    const description = args.description
      ? sanitizeText(args.description)
      : undefined;
    await ctx.db.patch(args.categoryId, {
      name,
      slug,
      description,
      imageId: args.imageId,
    });
    if (category.imageId && category.imageId !== args.imageId) {
      await ctx.storage.delete(category.imageId);
    }
  },
});

export const remove = mutation({
  args: {
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAdminUser(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found");
    await assertHackathonWritable(ctx, category.hackathonId, user);
    const ideasWithCategory = await ctx.db
      .query("ideas")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();
    for (const idea of ideasWithCategory) {
      await ctx.db.patch(idea._id, { categoryId: undefined });
    }
    await ctx.db.delete(args.categoryId);
    if (category.imageId) {
      await ctx.storage.delete(category.imageId);
    }
  },
});

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("categories")),
  },
  handler: async (ctx, { orderedIds }) => {
    const { user } = await getAdminUser(ctx);
    for (let i = 0; i < orderedIds.length; i++) {
      const category = await ctx.db.get(orderedIds[i]);
      if (category) await assertHackathonWritable(ctx, category.hackathonId, user);
      await ctx.db.patch(orderedIds[i], { order: i });
    }
  },
});

async function getScopedCategories(
  ctx: Parameters<typeof getAuthenticatedUser>[0],
  hackathonId: Id<"hackathons"> | undefined,
) {
  if (!hackathonId) return await ctx.db.query("categories").order("asc").collect();
  const [scoped, legacy] = await Promise.all([
    ctx.db
      .query("categories")
      .withIndex("by_hackathon", (q) => q.eq("hackathonId", hackathonId))
      .collect(),
    ctx.db
      .query("categories")
      .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
      .collect(),
  ]);
  return [...scoped, ...legacy];
}
