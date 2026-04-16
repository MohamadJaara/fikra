import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  getAdminUser,
  getAuthenticatedUser,
  sanitizeText,
  slugifyName,
} from "./lib";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);
    return await ctx.db.query("resources").order("asc").collect();
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
      .map((item) => sanitizeText(item))
      .filter(Boolean);

    if (items.length === 0) throw new Error("No valid names provided");

    const created: string[] = [];
    const skipped: string[] = [];

    for (const name of items) {
      const slug = slugifyName(name);
      if (!slug) {
        skipped.push(name);
        continue;
      }

      const existing = await ctx.db
        .query("resources")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (existing) {
        skipped.push(name);
      } else {
        await ctx.db.insert("resources", { name, slug });
        created.push(name);
      }
    }

    return { created, skipped };
  },
});

export const remove = mutation({
  args: {
    resourceId: v.id("resources"),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);

    const resource = await ctx.db.get(args.resourceId);
    if (!resource) throw new Error("Resource not found");

    await ctx.db.delete(args.resourceId);
  },
});
