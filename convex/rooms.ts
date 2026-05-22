import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAdminUser, isEffectiveIdeaMember, sanitizeText } from "./lib";
import { ROOM_TYPES } from "../lib/constants";
import { internal } from "./_generated/api";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const rooms = await ctx.db.query("rooms").collect();

    const withDetails = await Promise.all(
      rooms.map(async (room) => {
        const assignedIdeas = await ctx.db
          .query("ideas")
          .withIndex("by_room", (q) => q.eq("roomId", room._id))
          .collect();

        return {
          _id: room._id,
          _creationTime: room._creationTime,
          name: room.name,
          type: room.type,
          address: room.address,
          directions: room.directions,
          mapsLink: room.mapsLink,
          assignedIdeaIds: assignedIdeas.map((i) => i._id),
          assignedIdeaTitles: assignedIdeas.map((i) => i.title),
        };
      }),
    );

    return withDetails.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    address: v.optional(v.string()),
    directions: v.optional(v.string()),
    mapsLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);

    const name = sanitizeText(args.name);
    if (!name) throw new Error("Room name is required");
    if (name.length > 100)
      throw new Error("Room name must be at most 100 characters");

    if (!ROOM_TYPES.includes(args.type as (typeof ROOM_TYPES)[number])) {
      throw new Error("Invalid room type");
    }

    return await ctx.db.insert("rooms", {
      name,
      type: args.type,
      address: args.address ? sanitizeText(args.address) : undefined,
      directions: args.directions ? sanitizeText(args.directions) : undefined,
      mapsLink: args.mapsLink ? sanitizeText(args.mapsLink) : undefined,
    });
  },
});

export const queueFullIdeasForRooms = mutation({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const fullIdeas = await ctx.db
      .query("ideas")
      .withIndex("by_status", (q) => q.eq("status", "full"))
      .collect();

    let queuedCount = 0;
    const now = Date.now();
    for (const idea of fullIdeas) {
      if (idea.roomId || idea.roomRequestStatus === "assigned") continue;
      if (
        idea.teamFormationStatus === "formed" &&
        idea.roomRequestStatus === "requested"
      ) {
        continue;
      }

      await ctx.db.patch(idea._id, {
        teamFormationStatus: "formed",
        teamFormationSource: idea.teamFormationSource ?? "auto",
        teamFormedAt: idea.teamFormedAt ?? now,
        roomRequestStatus: "requested",
        roomRequestedAt: idea.roomRequestedAt ?? now,
      });
      queuedCount++;
    }

    return {
      checkedCount: fullIdeas.length,
      queuedCount,
    };
  },
});

export const update = mutation({
  args: {
    roomId: v.id("rooms"),
    name: v.string(),
    type: v.string(),
    address: v.optional(v.string()),
    directions: v.optional(v.string()),
    mapsLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);

    const name = sanitizeText(args.name);
    if (!name) throw new Error("Room name is required");
    if (name.length > 100)
      throw new Error("Room name must be at most 100 characters");

    if (!ROOM_TYPES.includes(args.type as (typeof ROOM_TYPES)[number])) {
      throw new Error("Invalid room type");
    }

    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    if (args.type === "team" && room.type !== "team") {
      const assignedIdeas = await ctx.db
        .query("ideas")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .collect();
      if (assignedIdeas.length > 1) {
        throw new Error(
          "Shared rooms assigned to multiple ideas cannot be converted to team rooms",
        );
      }
    }

    await ctx.db.patch(args.roomId, {
      name,
      type: args.type,
      address: args.address ? sanitizeText(args.address) : undefined,
      directions: args.directions ? sanitizeText(args.directions) : undefined,
      mapsLink: args.mapsLink ? sanitizeText(args.mapsLink) : undefined,
    });
  },
});

export const remove = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);

    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const assignedIdeas = await ctx.db
      .query("ideas")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const idea of assignedIdeas) {
      await ctx.db.patch(idea._id, {
        roomId: undefined,
        roomRequestStatus:
          idea.teamFormationStatus === "formed" ? "requested" : "none",
        roomRequestedAt:
          idea.teamFormationStatus === "formed"
            ? (idea.roomRequestedAt ?? Date.now())
            : undefined,
      });
    }

    await ctx.db.delete(args.roomId);
  },
});

export const assignToIdea = mutation({
  args: {
    roomId: v.id("rooms"),
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAdminUser(ctx);

    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found");

    if (room.type === "team") {
      const assignedIdea = await ctx.db
        .query("ideas")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .first();
      if (assignedIdea && assignedIdea._id !== args.ideaId) {
        throw new Error("Team rooms can only be assigned to one idea");
      }
    }

    await ctx.db.patch(args.ideaId, {
      roomId: args.roomId,
      teamFormationStatus: "formed",
      teamFormationSource: idea.teamFormationSource ?? "auto",
      teamFormedAt: idea.teamFormedAt ?? Date.now(),
      roomRequestStatus: "assigned",
      roomRequestedAt: idea.roomRequestedAt ?? Date.now(),
    });

    const memberships = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))
      .collect();
    const recipientIds = new Set([
      idea.ownerId,
      ...memberships
        .filter((member) => isEffectiveIdeaMember(member, idea))
        .map((member) => member.userId),
    ]);
    for (const recipientId of recipientIds) {
      await ctx.runMutation(internal.notifications.create, {
        recipientId,
        actorId: userId,
        ideaId: args.ideaId,
        type: "room_assigned",
      });
    }
  },
});

export const unassignFromIdea = mutation({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    await getAdminUser(ctx);

    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found");

    await ctx.db.patch(args.ideaId, {
      roomId: undefined,
      roomRequestStatus:
        idea.teamFormationStatus === "formed" ? "requested" : "none",
      roomRequestedAt:
        idea.teamFormationStatus === "formed"
          ? (idea.roomRequestedAt ?? Date.now())
          : undefined,
    });
  },
});
