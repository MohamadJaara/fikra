import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getAdminUser, sanitizeText } from "./lib";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);
    return await ctx.db.query("categories").order("asc").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);
    const name = sanitizeText(args.name);
    if (!name) throw new Error("Category name is required");
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) throw new Error("Category already exists");
    return await ctx.db.insert("categories", { name, slug });
  },
});

export const update = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);
    const name = sanitizeText(args.name);
    if (!name) throw new Error("Category name is required");
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing && existing._id !== args.categoryId) {
      throw new Error("Category already exists");
    }
    await ctx.db.patch(args.categoryId, { name, slug });
  },
});

export const remove = mutation({
  args: {
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);
    const ideasWithCategory = await ctx.db
      .query("ideas")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();
    for (const idea of ideasWithCategory) {
      await ctx.db.patch(idea._id, { categoryId: undefined });
    }
    await ctx.db.delete(args.categoryId);
  },
});
