import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getAdminUser,
  getHackathonByIdOrCurrent,
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

async function scopedResults<T>(
  hackathonId: Id<"hackathons"> | undefined,
  scoped: (hackathonId: Id<"hackathons">) => Promise<T[]>,
  legacy: () => Promise<T[]>,
  global: () => Promise<T[]>,
) {
  if (!hackathonId) return await global();
  return [...(await scoped(hackathonId)), ...(await legacy())];
}

export const stats = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAdminUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const scopedHackathonId = hackathon?._id;

    const [
      users,
      participants,
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
      scopedHackathonId
        ? ctx.db
            .query("hackathonParticipants")
            .withIndex("by_hackathon", (q) =>
              q.eq("hackathonId", scopedHackathonId),
            )
            .collect()
        : Promise.resolve([]),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("ideas")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("ideas")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("ideas").collect(),
      ),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("comments")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("comments")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("comments").collect(),
      ),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("reactions")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("reactions")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("reactions").collect(),
      ),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("ideaInterest")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("ideaInterest")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("ideaInterest").collect(),
      ),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("ideaMembers")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("ideaMembers")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("ideaMembers").collect(),
      ),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("resourceRequests")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("resourceRequests")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("resourceRequests").collect(),
      ),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("resources")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("resources")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("resources").collect(),
      ),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("roles")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("roles")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("roles").collect(),
      ),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("rooms")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("rooms")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("rooms").collect(),
      ),
    ]);

    const hasParticipants = participants.length > 0;
    const onboardedUsers = hasParticipants
      ? participants.filter((p) => p.onboardingComplete).length
      : users.filter((u) => u.onboardingComplete).length;
    const onsiteUsers = hasParticipants
      ? participants.filter((p) => p.participationMode === "onsite").length
      : users.filter((u) => u.participationMode === "onsite").length;
    const remoteUsers = hasParticipants
      ? participants.filter((p) => p.participationMode === "remote").length
      : users.filter((u) => u.participationMode === "remote").length;

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

    const roleSources = hasParticipants ? participants : users;
    for (const source of roleSources) {
      for (const role of source.roles ?? []) {
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
      totalUsers: hasParticipants ? participants.length : users.length,
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

export const ideasReport = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAdminUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const scopedHackathonId = hackathon?._id;

    const [
      ideas,
      users,
      rooms,
      comments,
      reactions,
      interest,
      memberships,
      resourceRequests,
    ] = await Promise.all([
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("ideas")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("ideas")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("ideas").collect(),
      ),
      ctx.db.query("users").collect(),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("rooms")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("rooms")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("rooms").collect(),
      ),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("comments")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("comments")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("comments").collect(),
      ),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("reactions")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("reactions")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("reactions").collect(),
      ),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("ideaInterest")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("ideaInterest")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("ideaInterest").collect(),
      ),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("ideaMembers")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("ideaMembers")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("ideaMembers").collect(),
      ),
      scopedResults(
        scopedHackathonId,
        (id) =>
          ctx.db
            .query("resourceRequests")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
            .collect(),
        () =>
          ctx.db
            .query("resourceRequests")
            .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
            .collect(),
        () => ctx.db.query("resourceRequests").collect(),
      ),
    ]);

    const userById = new Map(users.map((user) => [user._id, user]));
    const roomById = new Map(rooms.map((room) => [room._id, room]));
    const commentsByIdea: Record<string, number> = {};
    const reactionsByIdea: Record<string, number> = {};
    const interestByIdea: Record<string, number> = {};
    const resourcesByIdea: Record<string, number> = {};
    const membersByIdea = new Map<Id<"ideas">, Doc<"ideaMembers">[]>();
    const byStatus: Record<string, number> = {};

    for (const comment of comments) increment(commentsByIdea, comment.ideaId);
    for (const reaction of reactions) increment(reactionsByIdea, reaction.ideaId);
    for (const item of interest) increment(interestByIdea, item.ideaId);
    for (const request of resourceRequests) {
      if (!request.resolved) increment(resourcesByIdea, request.ideaId);
    }
    for (const membership of memberships) {
      const current = membersByIdea.get(membership.ideaId) ?? [];
      current.push(membership);
      membersByIdea.set(membership.ideaId, current);
    }
    for (const idea of ideas) increment(byStatus, idea.status);

    const roomUsage = rooms
      .map((room) => {
        const assignedIdeas = ideas.filter((idea) => idea.roomId === room._id);
        return {
          roomId: room._id,
          name: room.name,
          type: room.type,
          assignmentLimit: room.assignmentLimit,
          assignedIdeas: assignedIdeas.length,
          assignedIdeaTitles: assignedIdeas.map((idea) => idea.title),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const ideaRows = ideas
      .map((idea) => {
        const owner = userById.get(idea.ownerId);
        const room = idea.roomId ? roomById.get(idea.roomId) : null;
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
          }
        }
        const teamSize = resolveTeamSize(idea);
        const memberCount = effectiveMembers.length;
        const missingRoles = idea.lookingForRoles.filter(
          (role) => !filledRoles.has(role),
        );
        const hasReachedCapacity = memberCount >= teamSizeCapacity(teamSize);
        const teamFormationStatus =
          idea.teamFormationStatus ??
          (idea.status !== IDEA_STATUS_SHELVED &&
          (idea.status === "full" || hasReachedCapacity)
            ? "formed"
            : "forming");
        const roomRequestStatus = idea.roomId
          ? "assigned"
          : (idea.roomRequestStatus ?? "none");

        return {
          ideaId: idea._id,
          title: idea.title,
          ownerName: getUserDisplayName(owner),
          ownerEmail: owner?.email,
          status: idea.status,
          isShelved: idea.status === IDEA_STATUS_SHELVED,
          adminShelvedAt: idea.adminShelvedAt,
          teamSize,
          memberCount,
          teamFormationStatus,
          hasReachedCapacity,
          missingRoles,
          roomRequestStatus,
          roomName: room?.name,
          roomType: room?.type,
          onsiteOnly: idea.onsiteOnly ?? false,
          comments: commentsByIdea[idea._id] ?? 0,
          reactions: reactionsByIdea[idea._id] ?? 0,
          interest: interestByIdea[idea._id] ?? 0,
          unresolvedResources: resourcesByIdea[idea._id] ?? 0,
          createdAt: idea._creationTime,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    const assignedIdeas = ideaRows.filter((idea) => idea.roomName).length;
    const shelvedIdeas = ideaRows.filter((idea) => idea.isShelved).length;
    const roomRequests = ideaRows.filter(
      (idea) => idea.roomRequestStatus === "requested",
    ).length;
    const activeIdeas = ideaRows.filter((idea) => !idea.isShelved);
    const decisionQueues = {
      roomRequests: ideaRows.filter(
        (idea) => !idea.isShelved && idea.roomRequestStatus === "requested",
      ),
      readyWithoutRoomRequest: ideaRows.filter(
        (idea) =>
          !idea.isShelved &&
          !idea.roomName &&
          idea.roomRequestStatus !== "requested" &&
          (idea.teamFormationStatus === "formed" ||
            idea.status === "full" ||
            idea.hasReachedCapacity),
      ),
      buildingWithoutRoom: ideaRows.filter(
        (idea) => idea.status === "building" && !idea.roomName,
      ),
      resourceBlocked: activeIdeas.filter(
        (idea) => idea.unresolvedResources > 0,
      ),
      shelvedIdeas: ideaRows.filter((idea) => idea.isShelved),
      highInterestUnassigned: activeIdeas
        .filter((idea) => !idea.roomName && idea.interest > 0)
        .sort((a, b) => b.interest - a.interest)
        .slice(0, 10),
    };

    return {
      generatedAt: Date.now(),
      generatedBy: userId,
      summary: {
        totalIdeas: ideas.length,
        shelvedIdeas,
        activeIdeas: activeIdeas.length,
        assignedIdeas,
        unassignedIdeas: ideas.length - assignedIdeas,
        roomRequests,
        readyWithoutRoomRequest:
          decisionQueues.readyWithoutRoomRequest.length,
        buildingWithoutRoom: decisionQueues.buildingWithoutRoom.length,
        resourceBlockedIdeas: decisionQueues.resourceBlocked.length,
        onsiteOnlyIdeas: ideaRows.filter((idea) => idea.onsiteOnly).length,
        totalRooms: rooms.length,
        teamRooms: rooms.filter((room) => room.type === "team").length,
        sharedRooms: rooms.filter((room) => room.type === "shared").length,
        totalComments: comments.length,
        totalReactions: reactions.length,
        totalInterest: interest.length,
        byStatus,
      },
      decisionQueues,
      roomUsage,
      ideas: ideaRows,
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
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAdminUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const scopedHackathonId = hackathon?._id;

    const [users, participants] = await Promise.all([
      ctx.db.query("users").collect(),
      scopedHackathonId
        ? ctx.db
            .query("hackathonParticipants")
            .withIndex("by_hackathon", (q) =>
              q.eq("hackathonId", scopedHackathonId),
            )
            .collect()
        : Promise.resolve([]),
    ]);
    const participantByUser = new Map(
      participants.map((participant) => [participant.userId, participant]),
    );

    const withCounts = await Promise.all(
      users.map(async (user) => {
        const [ownedIdeas, memberships, interest] = await Promise.all([
          scopedResults(
            scopedHackathonId,
            (id) =>
              ctx.db
                .query("ideas")
                .withIndex("by_hackathon_and_owner", (q) =>
                  q.eq("hackathonId", id).eq("ownerId", user._id),
                )
                .collect(),
            () =>
              ctx.db
                .query("ideas")
                .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
                .filter((q) => q.eq(q.field("hackathonId"), undefined))
                .collect(),
            () =>
              ctx.db
                .query("ideas")
                .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
                .collect(),
          ),
          scopedResults(
            scopedHackathonId,
            (id) =>
              ctx.db
                .query("ideaMembers")
                .withIndex("by_hackathon_and_user", (q) =>
                  q.eq("hackathonId", id).eq("userId", user._id),
                )
                .collect(),
            () =>
              ctx.db
                .query("ideaMembers")
                .withIndex("by_user", (q) => q.eq("userId", user._id))
                .filter((q) => q.eq(q.field("hackathonId"), undefined))
                .collect(),
            () =>
              ctx.db
                .query("ideaMembers")
                .withIndex("by_user", (q) => q.eq("userId", user._id))
                .collect(),
          ),
          scopedResults(
            scopedHackathonId,
            (id) =>
              ctx.db
                .query("ideaInterest")
                .withIndex("by_hackathon_and_user", (q) =>
                  q.eq("hackathonId", id).eq("userId", user._id),
                )
                .collect(),
            () =>
              ctx.db
                .query("ideaInterest")
                .withIndex("by_user", (q) => q.eq("userId", user._id))
                .filter((q) => q.eq(q.field("hackathonId"), undefined))
                .collect(),
            () =>
              ctx.db
                .query("ideaInterest")
                .withIndex("by_user", (q) => q.eq("userId", user._id))
                .collect(),
          ),
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
        const participant = participantByUser.get(user._id);

        return {
          _id: user._id,
          _creationTime: user._creationTime,
          name: getUserDisplayName(user, ""),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          image: user.image,
          roles: participant?.roles ?? user.roles,
          handle: user.handle,
          isAdmin: user.isAdmin,
          onboardingComplete:
            participant?.onboardingComplete ?? user.onboardingComplete,
          participationMode:
            participant?.participationMode ?? user.participationMode,
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
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAdminUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const scopedHackathonId = hackathon?._id;

    const ideas = await scopedResults(
      scopedHackathonId,
      (id) =>
        ctx.db
          .query("ideas")
          .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
          .collect(),
      () =>
        ctx.db
          .query("ideas")
          .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
          .collect(),
      () => ctx.db.query("ideas").collect(),
    );

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
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAdminUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const scopedHackathonId = hackathon?._id;

    const comments = await scopedResults(
      scopedHackathonId,
      (id) =>
        ctx.db
          .query("comments")
          .withIndex("by_hackathon", (q) => q.eq("hackathonId", id))
          .collect(),
      () =>
        ctx.db
          .query("comments")
          .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
          .collect(),
      () => ctx.db.query("comments").collect(),
    );

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
