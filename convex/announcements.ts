import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  assertHackathonWritable,
  getAdminUser,
  getAuthenticatedUser,
  getHackathonByIdOrCurrent,
  getUserDisplayName,
  validateStringLength,
} from "./lib";

const ANNOUNCEMENT_TYPES = ["info", "urgent", "celebration"] as const;

export const getActive = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);

    const dismissed = hackathon
      ? await ctx.db
          .query("dismissedAnnouncements")
          .withIndex("by_hackathon_and_user", (q) =>
            q.eq("hackathonId", hackathon._id).eq("userId", userId),
          )
          .collect()
      : await ctx.db
          .query("dismissedAnnouncements")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();
    const dismissedIds = new Set(dismissed.map((d) => d.announcementId));

    const active = hackathon
      ? [
          ...(await ctx.db
            .query("announcements")
            .withIndex("by_hackathon_and_active", (q) =>
              q.eq("hackathonId", hackathon._id).eq("active", true),
            )
            .order("desc")
            .collect()),
          ...(await ctx.db
            .query("announcements")
            .withIndex("by_hackathon_and_active", (q) =>
              q.eq("hackathonId", undefined).eq("active", true),
            )
            .order("desc")
            .collect()),
        ]
      : await ctx.db
          .query("announcements")
          .withIndex("by_active", (q) => q.eq("active", true))
          .order("desc")
          .collect();

    return active
      .filter((announcement) => !dismissedIds.has(announcement._id))
      .slice(0, 5);
  },
});

export const list = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAdminUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);

    const announcements = hackathon
      ? await ctx.db
          .query("announcements")
          .withIndex("by_hackathon", (q) =>
            q.eq("hackathonId", hackathon._id),
          )
          .order("desc")
          .collect()
      : await ctx.db.query("announcements").order("desc").collect();

    return Promise.all(
      announcements.map(async (a) => {
        const creator = await ctx.db.get(a.createdBy);
        const dismissedCount = (
          await ctx.db
            .query("dismissedAnnouncements")
            .withIndex("by_announcement_and_user", (q) =>
              q.eq("announcementId", a._id),
            )
            .collect()
        ).length;

        return {
          ...a,
          creatorName: getUserDisplayName(creator, "Unknown"),
          dismissedCount,
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    hackathonId: v.optional(v.id("hackathons")),
    title: v.string(),
    message: v.string(),
    type: v.union(...ANNOUNCEMENT_TYPES.map((t) => v.literal(t))),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await getAdminUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, args.hackathonId);
    await assertHackathonWritable(ctx, hackathon?._id, user);
    const title = validateStringLength(args.title, 1, 120, "Title");
    const message = validateStringLength(args.message, 1, 1000, "Message");

    return await ctx.db.insert("announcements", {
      hackathonId: hackathon?._id,
      title,
      message,
      type: args.type,
      active: true,
      createdBy: userId,
    });
  },
});

export const update = mutation({
  args: {
    announcementId: v.id("announcements"),
    title: v.optional(v.string()),
    message: v.optional(v.string()),
    type: v.optional(v.union(...ANNOUNCEMENT_TYPES.map((t) => v.literal(t)))),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user } = await getAdminUser(ctx);

    const { announcementId, ...updates } = args;
    const announcement = await ctx.db.get(announcementId);
    if (!announcement) throw new Error("Announcement not found");
    await assertHackathonWritable(ctx, announcement.hackathonId, user);

    const patch: Record<string, unknown> = {};
    if (updates.title !== undefined) {
      patch.title = validateStringLength(updates.title, 1, 120, "Title");
    }
    if (updates.message !== undefined) {
      patch.message = validateStringLength(updates.message, 1, 1000, "Message");
    }
    if (updates.type !== undefined) patch.type = updates.type;
    if (updates.active !== undefined) patch.active = updates.active;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(announcementId, patch);
    }
  },
});

export const remove = mutation({
  args: { announcementId: v.id("announcements") },
  handler: async (ctx, { announcementId }) => {
    const { user } = await getAdminUser(ctx);
    const announcement = await ctx.db.get(announcementId);
    if (!announcement) throw new Error("Announcement not found");
    await assertHackathonWritable(ctx, announcement.hackathonId, user);

    const dismissed = await ctx.db
      .query("dismissedAnnouncements")
      .withIndex("by_announcement_and_user", (q) =>
        q.eq("announcementId", announcementId),
      )
      .collect();
    for (const d of dismissed) await ctx.db.delete(d._id);

    await ctx.db.delete(announcementId);
  },
});

export const dismiss = mutation({
  args: { announcementId: v.id("announcements") },
  handler: async (ctx, { announcementId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const existing = await ctx.db
      .query("dismissedAnnouncements")
      .withIndex("by_announcement_and_user", (q) =>
        q.eq("announcementId", announcementId).eq("userId", userId),
      )
      .unique();
    if (existing) return;

    await ctx.db.insert("dismissedAnnouncements", {
      hackathonId:
        (await ctx.db.get(announcementId))?.hackathonId,
      announcementId,
      userId,
    });
  },
});
