import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  assertHackathonWritable,
  getAdminUser,
  getAuthenticatedUser,
  getHackathonByIdOrCurrent,
  sanitizeText,
  slugifyName,
} from "./lib";
import type { Id } from "./_generated/dataModel";

export const list = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const resources = await getScopedResources(ctx, hackathon?._id);
    return resources.sort((a, b) => a.name.localeCompare(b.name));
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

      const existing = hackathon
        ? await ctx.db
            .query("resources")
            .withIndex("by_hackathon_and_slug", (q) =>
              q.eq("hackathonId", hackathon._id).eq("slug", slug),
            )
            .first()
        : await ctx.db
            .query("resources")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .first();

      if (existing) {
        skipped.push(name);
      } else {
        await ctx.db.insert("resources", {
          hackathonId: hackathon?._id,
          name,
          slug,
        });
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
    const { user } = await getAdminUser(ctx);

    const resource = await ctx.db.get(args.resourceId);
    if (!resource) throw new Error("Resource not found");
    await assertHackathonWritable(ctx, resource.hackathonId, user);

    await ctx.db.delete(args.resourceId);
  },
});

async function getScopedResources(
  ctx: Parameters<typeof getAuthenticatedUser>[0],
  hackathonId: Id<"hackathons"> | undefined,
) {
  if (!hackathonId) return await ctx.db.query("resources").order("asc").collect();
  const [scoped, legacy] = await Promise.all([
    ctx.db
      .query("resources")
      .withIndex("by_hackathon", (q) => q.eq("hackathonId", hackathonId))
      .collect(),
    ctx.db
      .query("resources")
      .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
      .collect(),
  ]);
  return [...scoped, ...legacy];
}
