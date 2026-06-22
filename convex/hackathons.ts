import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  getAdminUser,
  getAuthenticatedUser,
  getCurrentHackathon,
  HACKATHON_STATUSES,
  PLATFORM_SETTING_KEY,
  slugifyName,
  validateStringLength,
} from "./lib";
import type { Id } from "./_generated/dataModel";

const hackathonStatusValidator = v.union(
  ...HACKATHON_STATUSES.map((status) => v.literal(status)),
);

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
    throw new Error("Start date must be valid");
  }
  if (endsAt !== undefined) {
    if (!Number.isFinite(endsAt) || endsAt <= 0) {
      throw new Error("End date must be valid");
    }
    if (endsAt <= startsAt) {
      throw new Error("End date must be after the start date");
    }
  }
}

async function setCurrentHackathon(
  ctx: MutationCtx,
  hackathonId: Id<"hackathons">,
  userId: Id<"users">,
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("platformSettings")
    .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTING_KEY))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      currentHackathonId: hackathonId,
      updatedBy: userId,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.insert("platformSettings", {
    key: PLATFORM_SETTING_KEY,
    currentHackathonId: hackathonId,
    updatedBy: userId,
    updatedAt: now,
  });
}

async function ensureUniqueSlug(
  ctx: MutationCtx,
  slug: string,
  excludeHackathonId?: Id<"hackathons">,
) {
  const existing = await ctx.db
    .query("hackathons")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (existing && existing._id !== excludeHackathonId) {
    throw new Error("Hackathon slug already exists");
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);
    const hackathons = await ctx.db
      .query("hackathons")
      .withIndex("by_startsAt")
      .order("desc")
      .take(200);
    return hackathons.filter((hackathon) => hackathon.status !== "archived");
  },
});

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);
    return await getCurrentHackathon(ctx);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await getAuthenticatedUser(ctx);
    return await ctx.db
      .query("hackathons")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

export const getForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);
    return await ctx.db
      .query("hackathons")
      .withIndex("by_startsAt")
      .order("desc")
      .take(200);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    slug: v.optional(v.string()),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    timezone: v.string(),
    location: v.optional(v.string()),
    note: v.optional(v.string()),
    status: v.optional(hackathonStatusValidator),
    cloneFromHackathonId: v.optional(v.id("hackathons")),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAdminUser(ctx);
    validateDateRange(args.startsAt, args.endsAt);

    const title = validateStringLength(args.title, 1, 100, "Hackathon title");
    const slug = args.slug
      ? slugifyName(validateStringLength(args.slug, 1, 100, "Slug"))
      : slugifyName(title);
    if (!slug) throw new Error("Slug must contain letters or numbers");
    await ensureUniqueSlug(ctx, slug);

    const timezone = validateTimezone(args.timezone);
    const now = Date.now();
    const hackathonId = await ctx.db.insert("hackathons", {
      title,
      slug,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      timezone,
      location: optionalText(args.location, 120, "Location"),
      note: optionalText(args.note, 240, "Note"),
      status: args.status ?? "upcoming",
      createdBy: userId,
      updatedBy: userId,
      updatedAt: now,
    });

    if (args.status === "active") {
      await setCurrentHackathon(ctx, hackathonId, userId);
    }
    if (args.cloneFromHackathonId) {
      await cloneConfig(ctx, args.cloneFromHackathonId, hackathonId);
    }

    return hackathonId;
  },
});

export const update = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    title: v.string(),
    slug: v.optional(v.string()),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    timezone: v.string(),
    location: v.optional(v.string()),
    note: v.optional(v.string()),
    status: hackathonStatusValidator,
  },
  handler: async (ctx, args) => {
    const { userId } = await getAdminUser(ctx);
    const existing = await ctx.db.get(args.hackathonId);
    if (!existing) throw new Error("Hackathon not found");
    validateDateRange(args.startsAt, args.endsAt);

    const title = validateStringLength(args.title, 1, 100, "Hackathon title");
    const slug = args.slug
      ? slugifyName(validateStringLength(args.slug, 1, 100, "Slug"))
      : slugifyName(title);
    if (!slug) throw new Error("Slug must contain letters or numbers");
    await ensureUniqueSlug(ctx, slug, args.hackathonId);

    await ctx.db.patch(args.hackathonId, {
      title,
      slug,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      timezone: validateTimezone(args.timezone),
      location: optionalText(args.location, 120, "Location"),
      note: optionalText(args.note, 240, "Note"),
      status: args.status,
      completedAt:
        args.status === "completed" ? (existing.completedAt ?? Date.now()) : undefined,
      completedBy:
        args.status === "completed" ? (existing.completedBy ?? userId) : undefined,
      updatedBy: userId,
      updatedAt: Date.now(),
    });

    if (args.status === "active") {
      await setCurrentHackathon(ctx, args.hackathonId, userId);
    }
  },
});

export const activate = mutation({
  args: { hackathonId: v.id("hackathons") },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAdminUser(ctx);
    const hackathon = await ctx.db.get(hackathonId);
    if (!hackathon) throw new Error("Hackathon not found");

    const now = Date.now();
    const activeHackathons = await ctx.db
      .query("hackathons")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    for (const active of activeHackathons) {
      if (active._id !== hackathonId) {
        await ctx.db.patch(active._id, {
          status: "completed",
          completedAt: active.completedAt ?? now,
          completedBy: active.completedBy ?? userId,
          updatedBy: userId,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(hackathonId, {
      status: "active",
      completedAt: undefined,
      completedBy: undefined,
      updatedBy: userId,
      updatedAt: now,
    });
    await setCurrentHackathon(ctx, hackathonId, userId);
  },
});

export const complete = mutation({
  args: { hackathonId: v.id("hackathons") },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAdminUser(ctx);
    const hackathon = await ctx.db.get(hackathonId);
    if (!hackathon) throw new Error("Hackathon not found");
    const now = Date.now();
    await ctx.db.patch(hackathonId, {
      status: "completed",
      completedAt: hackathon.completedAt ?? now,
      completedBy: hackathon.completedBy ?? userId,
      updatedBy: userId,
      updatedAt: now,
    });
  },
});

export const archive = mutation({
  args: { hackathonId: v.id("hackathons") },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAdminUser(ctx);
    const hackathon = await ctx.db.get(hackathonId);
    if (!hackathon) throw new Error("Hackathon not found");

    await ctx.db.patch(hackathonId, {
      status: "archived",
      updatedBy: userId,
      updatedAt: Date.now(),
    });
  },
});

export const cloneConfigFrom = mutation({
  args: {
    sourceHackathonId: v.id("hackathons"),
    targetHackathonId: v.id("hackathons"),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);
    await cloneConfig(ctx, args.sourceHackathonId, args.targetHackathonId);
  },
});

async function cloneConfig(
  ctx: MutationCtx,
  sourceHackathonId: Id<"hackathons">,
  targetHackathonId: Id<"hackathons">,
) {
  if (sourceHackathonId === targetHackathonId) {
    throw new Error("Choose two different hackathons");
  }
  const [source, target] = await Promise.all([
    ctx.db.get(sourceHackathonId),
    ctx.db.get(targetHackathonId),
  ]);
  if (!source || !target) throw new Error("Hackathon not found");

  const [categories, resources, roles, rooms, announcements] =
    await Promise.all([
      ctx.db
        .query("categories")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", sourceHackathonId))
        .collect(),
      ctx.db
        .query("resources")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", sourceHackathonId))
        .collect(),
      ctx.db
        .query("roles")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", sourceHackathonId))
        .collect(),
      ctx.db
        .query("rooms")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", sourceHackathonId))
        .collect(),
      ctx.db
        .query("announcements")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", sourceHackathonId))
        .collect(),
    ]);

  for (const category of categories) {
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_hackathon_and_slug", (q) =>
        q.eq("hackathonId", targetHackathonId).eq("slug", category.slug),
      )
      .first();
    if (!existing) {
      await ctx.db.insert("categories", {
        hackathonId: targetHackathonId,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageId: category.imageId,
        order: category.order,
      });
    }
  }

  for (const resource of resources) {
    const existing = await ctx.db
      .query("resources")
      .withIndex("by_hackathon_and_slug", (q) =>
        q.eq("hackathonId", targetHackathonId).eq("slug", resource.slug),
      )
      .first();
    if (!existing) {
      await ctx.db.insert("resources", {
        hackathonId: targetHackathonId,
        name: resource.name,
        slug: resource.slug,
      });
    }
  }

  for (const role of roles) {
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_hackathon_and_slug", (q) =>
        q.eq("hackathonId", targetHackathonId).eq("slug", role.slug),
      )
      .first();
    if (!existing) {
      await ctx.db.insert("roles", {
        hackathonId: targetHackathonId,
        name: role.name,
        slug: role.slug,
        aliasSlugs: role.aliasSlugs,
        deletedAt: role.deletedAt,
      });
    }
  }

  for (const room of rooms) {
    await ctx.db.insert("rooms", {
      hackathonId: targetHackathonId,
      name: room.name,
      type: room.type,
      assignmentLimit: room.assignmentLimit,
      address: room.address,
      directions: room.directions,
      mapsLink: room.mapsLink,
    });
  }

  for (const announcement of announcements) {
    await ctx.db.insert("announcements", {
      hackathonId: targetHackathonId,
      title: announcement.title,
      message: announcement.message,
      type: announcement.type,
      active: announcement.active,
      createdBy: announcement.createdBy,
    });
  }
}
