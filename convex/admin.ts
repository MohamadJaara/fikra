import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getAdminUser,
  getUserDisplayName,
  isEffectiveIdeaMember,
  mergeUniqueStringArrays,
  resolveTeamSize,
} from "./lib";
import { STATUSES } from "../lib/constants";
import { internal } from "./_generated/api";
import { refreshIdeaMemberStats } from "./ideaStats";

const statusValidator = v.union(...STATUSES.map((s) => v.literal(s)));
const IDEA_STATUS_SHELVED = "shelved";

function teamSizeCapacity(teamSize: ReturnType<typeof resolveTeamSize>) {
  if (teamSize === "solo") return 1;
  if (teamSize === "small") return 3;
  if (teamSize === "medium") return 6;
  return 7;
}

function increment(map: Record<string, number>, key: string, by = 1) {
  map[key] = (map[key] ?? 0) + by;
}

export const stats = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const [
      users,
      ideas,
      comments,
      reactions,
      ideaInterest,
      ideaMembers,
      resourceRequests,
      resources,
      roles,
      rooms,
    ] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("ideas").collect(),
      ctx.db.query("comments").collect(),
      ctx.db.query("reactions").collect(),
      ctx.db.query("ideaInterest").collect(),
      ctx.db.query("ideaMembers").collect(),
      ctx.db.query("resourceRequests").collect(),
      ctx.db.query("resources").collect(),
      ctx.db.query("roles").collect(),
      ctx.db.query("rooms").collect(),
    ]);

    const onboardedUsers = users.filter((u) => u.onboardingComplete).length;
    const onsiteUsers = users.filter(
      (u) => u.participationMode === "onsite",
    ).length;
    const remoteUsers = users.filter(
      (u) => u.participationMode === "remote",
    ).length;

    const ideasByStatus: Record<string, number> = {};
    const resourceNameBySlug: Record<string, string> = Object.fromEntries(
      resources.map((resource) => [resource.slug, resource.name]),
    );
    const activeRoles = roles.filter((role) => !role.deletedAt);
    const roleNameBySlug: Record<string, string> = Object.fromEntries(
      activeRoles.map((role) => [role.slug, role.name]),
    );
    const membersByIdea = new Map<Id<"ideas">, Doc<"ideaMembers">[]>();
    for (const member of ideaMembers) {
      const current = membersByIdea.get(member.ideaId) ?? [];
      current.push(member);
      membersByIdea.set(member.ideaId, current);
    }

    const teamFormation = { forming: 0, formed: 0 };
    const roomOverview = {
      totalRooms: rooms.length,
      teamRooms: rooms.filter((room) => room.type === "team").length,
      sharedRooms: rooms.filter((room) => room.type === "shared").length,
      assignedIdeas: 0,
      queuedRoomRequests: 0,
      readyTeamsMissingRoom: 0,
      availableTeamRooms: 0,
      assignedRooms: 0,
      onsiteOnlyIdeas: 0,
      buildingWithoutRoom: 0,
    };
    const roleSupply: Record<string, number> = {};
    const roleDemand: Record<string, number> = {};
    const missingRoleDemand: Record<string, number> = {};
    const filledRoleDemand: Record<string, number> = {};
    const ideasNeedingRooms: Array<{
      _id: Id<"ideas">;
      title: string;
      ownerName: string;
      memberCount: number;
      teamSize: ReturnType<typeof resolveTeamSize>;
      roomRequestStatus: string;
      teamFormationStatus: string;
      missingRoles: string[];
      unresolvedResources: number;
      interestCount: number;
    }> = [];

    for (const user of users) {
      for (const role of user.roles ?? []) {
        increment(roleSupply, role);
      }
    }

    for (const room of rooms) {
      const assignedIdeas = ideas.filter((idea) => idea.roomId === room._id);
      if (assignedIdeas.length > 0) roomOverview.assignedRooms++;
      if (room.type === "team" && assignedIdeas.length === 0) {
        roomOverview.availableTeamRooms++;
      }
    }

    for (const idea of ideas) {
      increment(ideasByStatus, idea.status);

      const effectiveMembers = (membersByIdea.get(idea._id) ?? []).filter(
        (member) => isEffectiveIdeaMember(member, idea),
      );
      const filledRoles = new Set<string>();
      for (const member of effectiveMembers) {
        for (const role of mergeUniqueStringArrays(
          member.memberRoles,
          member.role ? [member.role] : undefined,
        ) ?? []) {
          filledRoles.add(role);
          increment(filledRoleDemand, role);
        }
      }
      const missingRoles = idea.lookingForRoles.filter(
        (role) => !filledRoles.has(role),
      );
      for (const role of idea.lookingForRoles) increment(roleDemand, role);
      for (const role of missingRoles) increment(missingRoleDemand, role);

      const teamSize = resolveTeamSize(idea);
      const memberCount = idea.memberCount ?? effectiveMembers.length;
      const hasReachedCapacity = memberCount >= teamSizeCapacity(teamSize);
      const formationStatus =
        idea.teamFormationStatus ??
        (idea.status !== "shelved" &&
        (idea.status === "full" || hasReachedCapacity)
          ? "formed"
          : "forming");
      if (formationStatus === "formed") {
        teamFormation.formed++;
      } else {
        teamFormation.forming++;
      }

      if (idea.roomId) roomOverview.assignedIdeas++;
      if (idea.roomRequestStatus === "requested" && !idea.roomId) {
        roomOverview.queuedRoomRequests++;
      }
      if (idea.onsiteOnly) roomOverview.onsiteOnlyIdeas++;
      if (idea.status === "building" && !idea.roomId) {
        roomOverview.buildingWithoutRoom++;
      }

      const unresolvedResources = resourceRequests.filter(
        (request) => request.ideaId === idea._id && !request.resolved,
      ).length;
      const isReadyForRoom =
        idea.status !== "shelved" &&
        (formationStatus === "formed" || idea.status === "full");
      if (isReadyForRoom && !idea.roomId) {
        if (idea.roomRequestStatus !== "requested") {
          roomOverview.readyTeamsMissingRoom++;
        }
        ideasNeedingRooms.push({
          _id: idea._id,
          title: idea.title,
          ownerName: getUserDisplayName(
            users.find((user) => user._id === idea.ownerId),
          ),
          memberCount,
          teamSize,
          roomRequestStatus: idea.roomRequestStatus ?? "none",
          teamFormationStatus: formationStatus,
          missingRoles,
          unresolvedResources,
          interestCount: idea.interestCount ?? 0,
        });
      }
    }

    const unresolvedResourceRequests = resourceRequests.filter(
      (request) => !request.resolved,
    );
    const unresolvedResourcesByTag: Record<string, number> = {};
    for (const request of unresolvedResourceRequests) {
      increment(unresolvedResourcesByTag, request.tag);
    }

    const roleGaps = Array.from(
      new Set([
        ...Object.keys(roleDemand),
        ...Object.keys(missingRoleDemand),
        ...Object.keys(roleSupply),
      ]),
    )
      .map((slug) => ({
        slug,
        name: roleNameBySlug[slug] ?? slug,
        needed: roleDemand[slug] ?? 0,
        missing: missingRoleDemand[slug] ?? 0,
        filled: filledRoleDemand[slug] ?? 0,
        availableUsers: roleSupply[slug] ?? 0,
        gap: Math.max(
          (missingRoleDemand[slug] ?? 0) - (roleSupply[slug] ?? 0),
          0,
        ),
      }))
      .filter(
        (role) =>
          role.needed > 0 || role.missing > 0 || role.availableUsers > 0,
      )
      .sort(
        (a, b) =>
          b.gap - a.gap ||
          b.missing - a.missing ||
          b.needed - a.needed ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 8);

    const resourceNeeds = Object.entries(unresolvedResourcesByTag)
      .map(([slug, count]) => ({
        slug,
        name: resourceNameBySlug[slug] ?? slug,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8);

    const topIdeasNeedingRooms = ideasNeedingRooms
      .sort(
        (a, b) =>
          Number(b.roomRequestStatus === "requested") -
            Number(a.roomRequestStatus === "requested") ||
          b.memberCount - a.memberCount ||
          b.interestCount - a.interestCount,
      )
      .slice(0, 6);

    return {
      totalUsers: users.length,
      onboardedUsers,
      onsiteUsers,
      remoteUsers,
      totalIdeas: ideas.length,
      ideasByStatus,
      totalComments: comments.length,
      totalReactions: reactions.length,
      totalInterest: ideaInterest.length,
      totalMembers: ideaMembers.length,
      teamFormation,
      roomOverview,
      unresolvedResources: unresolvedResourceRequests.length,
      resourceNeeds,
      roleGaps,
      topIdeasNeedingRooms,
    };
  },
});

export const updateIdeaStatus = mutation({
  args: {
    ideaId: v.id("ideas"),
    status: statusValidator,
  },
  handler: async (ctx, { ideaId, status }) => {
    const { userId } = await getAdminUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");

    if (status === IDEA_STATUS_SHELVED) {
      await ctx.db.patch(ideaId, {
        status,
        needsTeammates: false,
        teamFormationStatus: "forming",
        teamFormationSource: undefined,
        teamFormedAt: undefined,
        roomRequestStatus: idea.roomId ? "assigned" : "none",
        roomRequestedAt: undefined,
        adminShelvedAt: Date.now(),
        adminShelvedBy: userId,
      });

      if (idea.status !== IDEA_STATUS_SHELVED) {
        await ctx.runMutation(internal.notifications.create, {
          recipientId: idea.ownerId,
          actorId: userId,
          ideaId,
          type: "idea_shelved_by_admin",
        });
      }
      return;
    }

    await ctx.db.patch(ideaId, {
      status,
      adminShelvedAt: undefined,
      adminShelvedBy: undefined,
    });
    await refreshIdeaMemberStats(ctx, ideaId);
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const users = await ctx.db.query("users").collect();

    const withCounts = await Promise.all(
      users.map(async (user) => {
        const [ownedIdeas, memberships, interest] = await Promise.all([
          ctx.db
            .query("ideas")
            .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
            .collect(),
          ctx.db
            .query("ideaMembers")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect(),
          ctx.db
            .query("ideaInterest")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect(),
        ]);

        const effectiveMemberships = (
          await Promise.all(
            memberships.map(async (membership) => {
              const idea = await ctx.db.get(membership.ideaId);
              if (!idea || !isEffectiveIdeaMember(membership, idea))
                return null;
              return membership;
            }),
          )
        ).filter((membership) => membership !== null);

        return {
          _id: user._id,
          _creationTime: user._creationTime,
          name: getUserDisplayName(user, ""),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          image: user.image,
          roles: user.roles,
          handle: user.handle,
          isAdmin: user.isAdmin,
          onboardingComplete: user.onboardingComplete,
          ownedIdeasCount: ownedIdeas.length,
          membershipsCount: effectiveMemberships.length,
          interestCount: interest.length,
        };
      }),
    );

    return withCounts.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const listIdeas = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const ideas = await ctx.db.query("ideas").collect();

    const withDetails = await Promise.all(
      ideas.map(async (idea) => {
        const [owner, members, comments, reactions, interest, resources] =
          await Promise.all([
            ctx.db.get(idea.ownerId),
            ctx.db
              .query("ideaMembers")
              .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
              .collect(),
            ctx.db
              .query("comments")
              .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
              .collect(),
            ctx.db
              .query("reactions")
              .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
              .collect(),
            ctx.db
              .query("ideaInterest")
              .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
              .collect(),
            ctx.db
              .query("resourceRequests")
              .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
              .collect(),
          ]);

        const effectiveMembers = members.filter((member) =>
          isEffectiveIdeaMember(member, idea),
        );

        return {
          _id: idea._id,
          _creationTime: idea._creationTime,
          title: idea.title,
          status: idea.status,
          teamSize: resolveTeamSize(idea),
          lookingForRoles: idea.lookingForRoles,
          ownerId: idea.ownerId,
          ownerName: getUserDisplayName(owner),
          ownerEmail: owner?.email,
          memberCount: effectiveMembers.length,
          commentCount: comments.length,
          reactionCount: reactions.length,
          interestCount: interest.length,
          unresolvedResources: resources.filter((r) => !r.resolved).length,
          roomId: idea.roomId,
          roomName: idea.roomId
            ? ((await ctx.db.get(idea.roomId))?.name ?? null)
            : null,
          teamFormationStatus: idea.teamFormationStatus ?? "forming",
          teamFormationSource: idea.teamFormationSource,
          teamFormedAt: idea.teamFormedAt,
          roomRequestStatus: idea.roomId
            ? "assigned"
            : (idea.roomRequestStatus ?? "none"),
          roomRequestedAt: idea.roomRequestedAt,
          onsiteOnly: idea.onsiteOnly ?? false,
        };
      }),
    );

    return withDetails.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const listComments = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const comments = await ctx.db.query("comments").collect();

    const withDetails = await Promise.all(
      comments.map(async (comment) => {
        const [author, idea] = await Promise.all([
          ctx.db.get(comment.userId),
          ctx.db.get(comment.ideaId),
        ]);

        return {
          _id: comment._id,
          _creationTime: comment._creationTime,
          content: comment.content,
          parentId: comment.parentId,
          authorName: getUserDisplayName(author),
          authorEmail: author?.email,
          ideaId: comment.ideaId,
          ideaTitle: idea?.title || "Deleted idea",
        };
      }),
    );

    return withDetails.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const setUserAdmin = mutation({
  args: {
    userId: v.id("users"),
    isAdmin: v.boolean(),
  },
  handler: async (ctx, { userId, isAdmin }) => {
    const { user: admin } = await getAdminUser(ctx);
    if (userId === admin._id) {
      throw new Error("Cannot change your own admin status");
    }
    await ctx.db.patch(userId, { isAdmin });
  },
});

export const deleteIdea = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    await getAdminUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");

    const members = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);

    const interest = await ctx.db
      .query("ideaInterest")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const i of interest) await ctx.db.delete(i._id);

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const c of comments) await ctx.db.delete(c._id);

    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const r of reactions) await ctx.db.delete(r._id);

    const resources = await ctx.db
      .query("resourceRequests")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const r of resources) await ctx.db.delete(r._id);

    await ctx.runMutation(internal.notifications.deleteForIdea, { ideaId });

    const transferRequests = await ctx.db
      .query("ownershipTransferRequests")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const request of transferRequests) await ctx.db.delete(request._id);

    await ctx.db.delete(ideaId);
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, { commentId }) => {
    await getAdminUser(ctx);

    const comment = await ctx.db.get(commentId);
    if (!comment) throw new Error("Comment not found");

    const deleteReplies = async (parentId: Id<"comments">) => {
      const replies = await ctx.db
        .query("comments")
        .withIndex("by_parent", (q) => q.eq("parentId", parentId))
        .collect();
      for (const reply of replies) {
        await deleteReplies(reply._id);
        await ctx.db.delete(reply._id);
      }
    };

    await deleteReplies(commentId);
    await ctx.db.delete(commentId);
  },
});

export const updateIdeaOnsiteOnly = mutation({
  args: {
    ideaId: v.id("ideas"),
    onsiteOnly: v.boolean(),
  },
  handler: async (ctx, { ideaId, onsiteOnly }) => {
    await getAdminUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");

    await ctx.db.patch(ideaId, { onsiteOnly });
  },
});
