import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getAdminUser, sanitizeText } from "./lib";

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
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);
    return await ctx.db.query("categories").order("asc").collect();
  },
});

export const listWithDetails = query({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);
    const categories = await ctx.db.query("categories").order("asc").collect();
    const ideas = await ctx.db.query("ideas").collect();

    const countByCategory: Record<string, number> = {};
    for (const idea of ideas) {
      if (idea.categoryId) {
        const id = idea.categoryId;
        countByCategory[id] = (countByCategory[id] || 0) + 1;
      }
    }

    return await Promise.all(
      categories.map(async (cat) => {
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
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await getAuthenticatedUser(ctx);
    const category = await ctx.db
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
    name: v.string(),
    description: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);
    const name = sanitizeText(args.name);
    if (!name) throw new Error("Category name is required");
    const slug = createCategorySlug(name);
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) throw new Error("Category already exists");
    const description = args.description
      ? sanitizeText(args.description)
      : undefined;
    return await ctx.db.insert("categories", {
      name,
      slug,
      description,
      imageId: args.imageId,
    });
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
    for (const name of items) {
      const slug = createCategorySlug(name);
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (existing) {
        skipped.push(name);
      } else {
        await ctx.db.insert("categories", { name, slug });
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
    await getAdminUser(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      if (args.imageId) {
        await ctx.storage.delete(args.imageId);
      }
      throw new Error("Category not found");
    }
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
    const existing = await ctx.db
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
    await getAdminUser(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found");
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
