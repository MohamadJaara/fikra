import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  getAdminUser,
  getAuthenticatedUser,
  validateStringLength,
} from "./lib";

const EVENT_SETTING_KEY = "main";

function optionalText(
  value: string | undefined,
  max: number,
  fieldName: string,
) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) {
    throw new Error(`${fieldName} must be at most ${max} characters`);
  }
  return trimmed;
}

async function getEventSetting(
  ctx: Parameters<typeof getAuthenticatedUser>[0],
) {
  return await ctx.db
    .query("eventSettings")
    .withIndex("by_key", (q) => q.eq("key", EVENT_SETTING_KEY))
    .unique();
}

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);

    const setting = await getEventSetting(ctx);
    if (!setting?.active) return null;

    return setting;
  },
});

export const getForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    return await getEventSetting(ctx);
  },
});

export const save = mutation({
  args: {
    title: v.string(),
    startsAt: v.number(),
    timezone: v.string(),
    location: v.optional(v.string()),
    note: v.optional(v.string()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAdminUser(ctx);

    if (!Number.isFinite(args.startsAt) || args.startsAt <= 0) {
      throw new Error("Event date must be valid");
    }

    const title = validateStringLength(args.title, 1, 80, "Event title");
    const timezone = validateStringLength(args.timezone, 1, 80, "Timezone");
    const location = optionalText(args.location, 120, "Location");
    const note = optionalText(args.note, 240, "Note");
    const now = Date.now();
    const existing = await getEventSetting(ctx);

    const setting = {
      key: EVENT_SETTING_KEY,
      title,
      startsAt: args.startsAt,
      timezone,
      location,
      note,
      active: args.active,
      updatedBy: userId,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, setting);
      return existing._id;
    }

    return await ctx.db.insert("eventSettings", setting);
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const existing = await getEventSetting(ctx);
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
