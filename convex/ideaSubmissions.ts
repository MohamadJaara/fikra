import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  getAdminUser,
  getAuthenticatedUser,
  getHackathonByIdOrCurrent,
  validateStringLength,
} from "./lib";
import type { Id } from "./_generated/dataModel";

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

async function getIdeaSubmissionSettingForHackathon(
  ctx: IdeaSubmissionSettingCtx,
  hackathonId?: Id<"hackathons">,
) {
  if (!hackathonId) return await getIdeaSubmissionSetting(ctx);
  return (
    (await ctx.db
      .query("ideaSubmissionSettings")
      .withIndex("by_hackathon_and_key", (q) =>
        q.eq("hackathonId", hackathonId).eq("key", IDEA_SUBMISSION_SETTING_KEY),
      )
      .unique()) ??
    (await ctx.db
      .query("ideaSubmissionSettings")
      .withIndex("by_hackathon_and_key", (q) =>
        q.eq("hackathonId", undefined).eq("key", IDEA_SUBMISSION_SETTING_KEY),
      )
      .first())
  );
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

export async function assertIdeaSubmissionsOpen(
  ctx: IdeaSubmissionSettingCtx,
  hackathonId?: Id<"hackathons">,
) {
  const setting = await getIdeaSubmissionSettingForHackathon(ctx, hackathonId);
  if (!setting?.active || setting.deadlineAt > Date.now()) return;

  throw new Error(
    setting.message?.trim() ||
      `Idea submissions closed on ${formatDeadline(setting.deadlineAt, setting.timezone)}. You can still browse ideas, join teams, and keep building from here.`,
  );
}

export const getCurrent = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAuthenticatedUser(ctx);

    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const setting = await getIdeaSubmissionSettingForHackathon(
      ctx,
      hackathon?._id,
    );
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
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAdminUser(ctx);

    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    return await getIdeaSubmissionSettingForHackathon(ctx, hackathon?._id);
  },
});

export const save = mutation({
  args: {
    deadlineAt: v.number(),
    hackathonId: v.optional(v.id("hackathons")),
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
    const hackathon = await getHackathonByIdOrCurrent(ctx, args.hackathonId);
    const existing = await getIdeaSubmissionSettingForHackathon(
      ctx,
      hackathon?._id,
    );
    const setting = {
      hackathonId: hackathon?._id,
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
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAdminUser(ctx);

    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const existing = await getIdeaSubmissionSettingForHackathon(
      ctx,
      hackathon?._id,
    );
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
