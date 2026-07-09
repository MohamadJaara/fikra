import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getAdminUser,
  getAuthenticatedUser,
  getCurrentHackathon,
  getHackathonByIdOrCurrent,
  validateStringLength,
} from "./lib";

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

function validateTimezone(timezone: string) {
  const trimmed = validateStringLength(timezone, 1, 80, "Timezone");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
  } catch {
    throw new Error("Timezone must be a valid IANA timezone");
  }
  return trimmed;
}

function validateDateRange(startsAt: number, endsAt: number | undefined) {
  if (!Number.isFinite(startsAt) || startsAt <= 0) {
    throw new Error("Event start date must be valid");
  }
  if (endsAt !== undefined) {
    if (!Number.isFinite(endsAt) || endsAt <= 0) {
      throw new Error("Event end date must be valid");
    }
    if (endsAt <= startsAt) {
      throw new Error("Event end date must be after the start date");
    }
  }
}

function asEvent(hackathon: Doc<"hackathons">) {
  return {
    ...hackathon,
    active: hackathon.status !== "draft" && hackathon.status !== "archived",
  };
}

async function requireHackathon(
  ctx: QueryCtx | MutationCtx,
  hackathonId?: Id<"hackathons">,
) {
  const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
  if (!hackathon) {
    throw new Error("Choose or create a hackathon first");
  }
  return hackathon;
}

/**
 * Compatibility adapter for clients that still use the legacy event API.
 * Hackathons are the sole source of truth; this module never reads or writes
 * the deprecated eventSettings table.
 */
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);
    const hackathon = await getCurrentHackathon(ctx);
    if (!hackathon || hackathon.status === "draft") return null;
    return asEvent(hackathon);
  },
});

export const getForAdmin = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAdminUser(ctx);
    return asEvent(await requireHackathon(ctx, hackathonId));
  },
});

export const save = mutation({
  args: {
    hackathonId: v.optional(v.id("hackathons")),
    title: v.string(),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    timezone: v.string(),
    location: v.optional(v.string()),
    note: v.optional(v.string()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAdminUser(ctx);
    const hackathon = await requireHackathon(ctx, args.hackathonId);
    validateDateRange(args.startsAt, args.endsAt);

    const status = args.active
      ? hackathon.status === "draft" || hackathon.status === "archived"
        ? "upcoming"
        : hackathon.status
      : "draft";
    const completed = status === "completed";

    await ctx.db.patch(hackathon._id, {
      title: validateStringLength(args.title, 1, 100, "Event title"),
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      timezone: validateTimezone(args.timezone),
      location: optionalText(args.location, 120, "Location"),
      note: optionalText(args.note, 240, "Note"),
      status,
      completedAt: completed ? hackathon.completedAt : undefined,
      completedBy: completed ? hackathon.completedBy : undefined,
      updatedBy: userId,
      updatedAt: Date.now(),
    });

    return hackathon._id;
  },
});

export const markDone = mutation({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAdminUser(ctx);
    const hackathon = await requireHackathon(ctx, hackathonId);
    const completedAt = hackathon.completedAt ?? Date.now();
    await ctx.db.patch(hackathon._id, {
      status: "completed",
      completedAt,
      completedBy: hackathon.completedBy ?? userId,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    return { completedAt };
  },
});

export const reopen = mutation({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAdminUser(ctx);
    const hackathon = await requireHackathon(ctx, hackathonId);
    await ctx.db.patch(hackathon._id, {
      status: "upcoming",
      completedAt: undefined,
      completedBy: undefined,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    return { completedAt: null };
  },
});

export const clear = mutation({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAdminUser(ctx);
    const hackathon = await requireHackathon(ctx, hackathonId);
    await ctx.db.patch(hackathon._id, {
      status: "draft",
      location: undefined,
      note: undefined,
      completedAt: undefined,
      completedBy: undefined,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
  },
});
