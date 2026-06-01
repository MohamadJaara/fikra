import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  getAdminUser,
  getAuthenticatedUser,
  validateStringLength,
} from "./lib";

const IDEA_SUBMISSION_SETTING_KEY = "main";
const DEFAULT_CLOSED_MESSAGE =
  "The idea submission deadline has passed. Thanks for bringing your creativity here. You can still browse ideas, join teams, and keep the momentum going.";

type IdeaSubmissionSettingCtx = Parameters<typeof getAuthenticatedUser>[0];

function optionalMessage(value: string | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 240) {
    throw new Error("Deadline message must be at most 240 characters");
  }
  return trimmed;
}

function validateTimezone(timezone: string) {
  const trimmed = validateStringLength(timezone, 1, 80, "Timezone");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
  } catch {
    throw new Error("Timezone must be a valid IANA timezone");
  }
  return trimmed;
}

async function getIdeaSubmissionSetting(ctx: IdeaSubmissionSettingCtx) {
  return await ctx.db
    .query("ideaSubmissionSettings")
    .withIndex("by_key", (q) => q.eq("key", IDEA_SUBMISSION_SETTING_KEY))
    .unique();
}

function formatDeadline(deadlineAt: number, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
      timeZoneName: "short",
    }).format(new Date(deadlineAt));
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(new Date(deadlineAt));
  }
}

export async function assertIdeaSubmissionsOpen(ctx: IdeaSubmissionSettingCtx) {
  const setting = await getIdeaSubmissionSetting(ctx);
  if (!setting?.active || setting.deadlineAt > Date.now()) return;

  throw new Error(
    setting.message?.trim() ||
      `Idea submissions closed on ${formatDeadline(setting.deadlineAt, setting.timezone)}. You can still browse ideas, join teams, and keep building from here.`,
  );
}

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);

    const setting = await getIdeaSubmissionSetting(ctx);
    if (!setting?.active) {
      return {
        isOpen: true,
        deadlineAt: null,
        timezone: null,
        message: null,
      };
    }

    return {
      isOpen: setting.deadlineAt > Date.now(),
      deadlineAt: setting.deadlineAt,
      timezone: setting.timezone,
      message: setting.message ?? DEFAULT_CLOSED_MESSAGE,
    };
  },
});

export const getForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    return await getIdeaSubmissionSetting(ctx);
  },
});

export const save = mutation({
  args: {
    deadlineAt: v.number(),
    timezone: v.string(),
    message: v.optional(v.string()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAdminUser(ctx);

    if (!Number.isFinite(args.deadlineAt) || args.deadlineAt <= 0) {
      throw new Error("Deadline must be a valid date");
    }

    const timezone = validateTimezone(args.timezone);
    const message = optionalMessage(args.message);
    const now = Date.now();
    const existing = await getIdeaSubmissionSetting(ctx);
    const setting = {
      key: IDEA_SUBMISSION_SETTING_KEY,
      deadlineAt: args.deadlineAt,
      timezone,
      message,
      active: args.active,
      updatedBy: userId,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, setting);
      return existing._id;
    }

    return await ctx.db.insert("ideaSubmissionSettings", setting);
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const existing = await getIdeaSubmissionSetting(ctx);
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
