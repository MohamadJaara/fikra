/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  asUser,
  DOMAIN,
  initTest,
  insertUser,
  makeIdeaArgs,
} from "./testHelpers.test";

type TestContext = ReturnType<typeof initTest>;

async function seedHackathon(
  t: TestContext,
  actorId: Id<"users">,
  slug: string,
  status: "active" | "completed" = "active",
) {
  return (await t.run(async (ctx: any) => {
    return await ctx.db.insert("hackathons", {
      slug,
      title: slug,
      startsAt: Date.now() + 24 * 60 * 60 * 1_000,
      endsAt: Date.now() + 48 * 60 * 60 * 1_000,
      timezone: "UTC",
      status,
      createdBy: actorId,
      updatedBy: actorId,
      updatedAt: Date.now(),
    });
  })) as Id<"hackathons">;
}

async function seedParticipant(
  t: TestContext,
  hackathonId: Id<"hackathons">,
  userId: Id<"users">,
) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("hackathonParticipants", {
      hackathonId,
      userId,
      roles: ["developer"],
      participationMode: "onsite",
      onboardingComplete: true,
      registeredAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}

async function seedCategory(
  t: TestContext,
  slug: string,
  hackathonId?: Id<"hackathons">,
) {
  return (await t.run(async (ctx: any) => {
    return await ctx.db.insert("categories", {
      hackathonId,
      name: slug,
      slug,
    });
  })) as Id<"categories">;
}

async function seedIdea(
  t: TestContext,
  ownerId: Id<"users">,
  title: string,
  hackathonId?: Id<"hackathons">,
) {
  return (await t.run(async (ctx: any) => {
    return await ctx.db.insert("ideas", {
      hackathonId,
      title,
      pitch: "Scoped mutation test",
      problem: "Mutation scope can drift",
      targetAudience: "Participants",
      skillsNeeded: [],
      teamSize: "small",
      status: "exploring",
      lookingForRoles: [],
      ownerId,
    });
  })) as Id<"ideas">;
}

describe("Event-owned mutation scoping", () => {
  test("participant mutations reject event-less writes", async () => {
    const t = initTest();
    const email = `eventless-admin@${DOMAIN}`;
    const userId = await insertUser(t, { email, isAdmin: true });
    const actingUser = asUser(t, userId, email);
    const ideaId = await seedIdea(t, userId, "Legacy unscoped idea");
    const otherIdeaId = await seedIdea(t, userId, "Other legacy idea");
    const categoryId = await seedCategory(t, "legacy-category");

    const ideaMutations = [
      () =>
        actingUser.mutation(api.comments.create, {
          ideaId,
          content: "Comment",
        }),
      () =>
        actingUser.mutation(api.reactions.toggle, {
          ideaId,
          type: "interested",
        }),
      () => actingUser.mutation(api.memberships.join, { ideaId }),
      () => actingUser.mutation(api.interest.express, { ideaId }),
      () => actingUser.mutation(api.bookmarks.toggle, { ideaId }),
      () =>
        actingUser.mutation(api.resourceRequests.add, {
          ideaId,
          tag: "server",
        }),
      () => actingUser.mutation(api.discover.dismissIdea, { ideaId }),
    ];
    for (const mutate of ideaMutations) {
      await expect(mutate()).rejects.toThrow(
        /Idea is not assigned to a hackathon|No hackathon is configured/,
      );
    }

    await expect(
      actingUser.mutation(api.relatedIdeas.markRelated, {
        ideaIdA: ideaId,
        ideaIdB: otherIdeaId,
        relationType: "related",
      }),
    ).rejects.toThrow(
      /Ideas are not assigned to a hackathon|No hackathon is configured/,
    );
    await expect(
      actingUser.mutation(api.ideas.create, makeIdeaArgs(categoryId)),
    ).rejects.toThrow("No hackathon is configured");
    await expect(
      actingUser.mutation(api.announcements.create, {
        title: "No event",
        message: "Must not be global",
        type: "info",
      }),
    ).rejects.toThrow("No hackathon is configured");
  });

  test("non-participants cannot mutate scoped event data", async () => {
    const t = initTest();
    const email = `non-participant@${DOMAIN}`;
    const userId = await insertUser(t, { email });
    const actingUser = asUser(t, userId, email);
    const currentHackathonId = await seedHackathon(
      t,
      userId,
      "non-participant-current-event",
    );
    await seedParticipant(t, currentHackathonId, userId);
    const hackathonId = await seedHackathon(t, userId, "non-participant-event");
    const ideaId = await seedIdea(t, userId, "Scoped idea", hackathonId);
    const announcementId = (await t.run(async (ctx: any) => {
      await ctx.db.insert("platformSettings", {
        key: "main",
        currentHackathonId,
        updatedBy: userId,
        updatedAt: Date.now(),
      });
      return await ctx.db.insert("announcements", {
        hackathonId,
        title: "Scoped announcement",
        message: "Participants only",
        type: "info",
        active: true,
        createdBy: userId,
      });
    })) as Id<"announcements">;

    await expect(
      actingUser.mutation(api.comments.create, { ideaId, content: "Comment" }),
    ).rejects.toThrow("Complete your hackathon profile");
    await expect(
      actingUser.mutation(api.bookmarks.toggle, { ideaId }),
    ).rejects.toThrow("Complete your hackathon profile");
    await t.run(async (ctx: any) => {
      await ctx.db.insert("votingSettings", {
        hackathonId,
        key: "main",
        active: true,
        currentRound: 1,
        updatedBy: userId,
        updatedAt: Date.now(),
      });
    });
    await expect(
      actingUser.mutation(api.voting.toggleVote, { ideaId, hackathonId }),
    ).rejects.toThrow("Complete your hackathon profile");
    await expect(
      actingUser.mutation(api.announcements.dismiss, { announcementId }),
    ).rejects.toThrow("Complete your hackathon profile");
  });

  test("participant writes retain the authoritative event scope", async () => {
    const t = initTest();
    const email = `scoped-participant@${DOMAIN}`;
    const userId = await insertUser(t, { email });
    const actingUser = asUser(t, userId, email);
    const hackathonId = await seedHackathon(t, userId, "scoped-write-event");
    await seedParticipant(t, hackathonId, userId);
    const ideaId = await seedIdea(t, userId, "Scoped write idea", hackathonId);
    const announcementId = (await t.run(async (ctx: any) => {
      await ctx.db.insert("resources", {
        hackathonId,
        name: "Server",
        slug: "server",
      });
      return await ctx.db.insert("announcements", {
        hackathonId,
        title: "Scoped announcement",
        message: "Dismiss me",
        type: "info",
        active: true,
        createdBy: userId,
      });
    })) as Id<"announcements">;

    await actingUser.mutation(api.comments.create, {
      ideaId,
      content: "Scoped comment",
    });
    await actingUser.mutation(api.reactions.toggle, {
      ideaId,
      type: "interested",
    });
    await actingUser.mutation(api.memberships.join, { ideaId });
    await actingUser.mutation(api.interest.express, { ideaId });
    await actingUser.mutation(api.bookmarks.toggle, { ideaId });
    await actingUser.mutation(api.resourceRequests.add, {
      ideaId,
      tag: "server",
    });
    await actingUser.mutation(api.discover.dismissIdea, { ideaId });
    await actingUser.mutation(api.announcements.dismiss, { announcementId });

    const scopes = await t.run(async (ctx: any) => {
      return await Promise.all(
        [
          "comments",
          "reactions",
          "ideaMembers",
          "ideaInterest",
          "ideaBookmarks",
          "resourceRequests",
          "dismissedIdeas",
          "dismissedAnnouncements",
        ].map(
          async (table) => (await ctx.db.query(table).first())?.hackathonId,
        ),
      );
    });
    expect(scopes).toEqual(Array(8).fill(hackathonId));
  });

  test("cross-event references and admin participants cannot bypass boundaries", async () => {
    const t = initTest();
    const email = `cross-event-admin@${DOMAIN}`;
    const userId = await insertUser(t, { email, isAdmin: true });
    const actingUser = asUser(t, userId, email);
    const hackathonA = await seedHackathon(t, userId, "cross-reference-a");
    const hackathonB = await seedHackathon(t, userId, "cross-reference-b");
    await seedParticipant(t, hackathonA, userId);
    await seedParticipant(t, hackathonB, userId);
    const ideaId = await seedIdea(
      t,
      userId,
      "Cross-reference idea",
      hackathonA,
    );

    const { parentId, requestId, announcementId } = await t.run(
      async (ctx: any) => {
        const parentId = await ctx.db.insert("comments", {
          hackathonId: hackathonB,
          ideaId,
          userId,
          content: "Corrupt parent",
        });
        const requestId = await ctx.db.insert("resourceRequests", {
          hackathonId: hackathonB,
          ideaId,
          tag: "server",
          resolved: false,
        });
        const announcementId = await ctx.db.insert("announcements", {
          hackathonId: hackathonA,
          title: "Cross dismissal",
          message: "Corrupt dismissal exists",
          type: "info",
          active: true,
          createdBy: userId,
        });
        await ctx.db.insert("dismissedAnnouncements", {
          hackathonId: hackathonB,
          announcementId,
          userId,
        });
        return { parentId, requestId, announcementId };
      },
    );

    await expect(
      actingUser.mutation(api.comments.create, {
        ideaId,
        parentId,
        content: "Reply",
      }),
    ).rejects.toThrow("Parent comment does not belong to this hackathon");
    await expect(
      actingUser.mutation(api.resourceRequests.resolve, { requestId }),
    ).rejects.toThrow("Resource request does not belong to this hackathon");
    await expect(
      actingUser.mutation(api.announcements.dismiss, { announcementId }),
    ).rejects.toThrow("Dismissal does not belong to this hackathon");

    await t.run(async (ctx: any) => {
      await ctx.db.patch(hackathonA, { status: "completed" });
    });
    await expect(
      actingUser.mutation(api.bookmarks.toggle, { ideaId }),
    ).rejects.toThrow("This hackathon is read-only");
  });

  test("nonparticipants cannot use a current-event legacy fallback for another event", async () => {
    const t = initTest();
    const ownerEmail = `matrix-owner@${DOMAIN}`;
    const targetEmail = `matrix-target@${DOMAIN}`;
    const ownerId = await insertUser(t, { email: ownerEmail });
    const targetOwnerId = await insertUser(t, { email: targetEmail });
    const asOwner = asUser(t, ownerId, ownerEmail);
    const asTarget = asUser(t, targetOwnerId, targetEmail);
    const currentHackathonId = await seedHackathon(
      t,
      ownerId,
      "matrix-current-event",
    );
    const protectedHackathonId = await seedHackathon(
      t,
      ownerId,
      "matrix-protected-event",
    );
    await seedParticipant(t, currentHackathonId, ownerId);
    await seedParticipant(t, currentHackathonId, targetOwnerId);
    const categoryId = await seedCategory(
      t,
      "matrix-protected-category",
      protectedHackathonId,
    );

    const seeded = await t.run(async (ctx: any) => {
      await ctx.db.insert("platformSettings", {
        key: "main",
        currentHackathonId,
        updatedBy: ownerId,
        updatedAt: Date.now(),
      });

      const sourceId = await ctx.db.insert("ideas", {
        hackathonId: protectedHackathonId,
        categoryId,
        title: "Matrix source",
        pitch: "Authorization matrix",
        problem: "Cross-event access",
        targetAudience: "Participants",
        skillsNeeded: [],
        teamSize: "small",
        status: "exploring",
        lookingForRoles: [],
        ownerId,
      });
      const insertTargetIdea = async (title: string) =>
        await ctx.db.insert("ideas", {
          hackathonId: protectedHackathonId,
          categoryId,
          title,
          pitch: "Authorization target",
          problem: "Cross-event access",
          targetAudience: "Participants",
          skillsNeeded: [],
          teamSize: "small",
          status: "exploring",
          lookingForRoles: [],
          ownerId: targetOwnerId,
        });
      const markTargetId = await insertTargetIdea("Matrix mark target");
      const requestTargetId = await insertTargetIdea("Matrix request target");
      const acceptTargetId = await insertTargetIdea("Matrix accept target");
      const declineTargetId = await insertTargetIdea("Matrix decline target");

      const ownerMembershipId = await ctx.db.insert("ideaMembers", {
        hackathonId: protectedHackathonId,
        ideaId: sourceId,
        userId: ownerId,
        joinedAsOwner: true,
        memberRoles: ["developer"],
      });
      const targetMembershipId = await ctx.db.insert("ideaMembers", {
        hackathonId: protectedHackathonId,
        ideaId: sourceId,
        userId: targetOwnerId,
        memberRoles: ["designer"],
      });
      const interestId = await ctx.db.insert("ideaInterest", {
        hackathonId: protectedHackathonId,
        ideaId: sourceId,
        userId: ownerId,
      });
      const resourceRequestId = await ctx.db.insert("resourceRequests", {
        hackathonId: protectedHackathonId,
        ideaId: sourceId,
        tag: "server",
        resolved: false,
      });
      const dismissalId = await ctx.db.insert("dismissedIdeas", {
        hackathonId: protectedHackathonId,
        ideaId: sourceId,
        userId: ownerId,
      });
      const requestRelationId = await ctx.db.insert("relatedIdeas", {
        hackathonId: protectedHackathonId,
        ideaIdA: sourceId,
        ideaIdB: requestTargetId,
        markedByUserId: ownerId,
        relationType: "duplicate",
      });
      const acceptRelationId = await ctx.db.insert("relatedIdeas", {
        hackathonId: protectedHackathonId,
        ideaIdA: sourceId,
        ideaIdB: acceptTargetId,
        markedByUserId: ownerId,
        relationType: "duplicate",
        mergeRequestedById: ownerId,
        mergeStatus: "pending",
      });
      const declineRelationId = await ctx.db.insert("relatedIdeas", {
        hackathonId: protectedHackathonId,
        ideaIdA: sourceId,
        ideaIdB: declineTargetId,
        markedByUserId: ownerId,
        relationType: "duplicate",
        mergeRequestedById: ownerId,
        mergeStatus: "pending",
      });

      return {
        sourceId,
        markTargetId,
        ownerMembershipId,
        targetMembershipId,
        interestId,
        resourceRequestId,
        dismissalId,
        requestRelationId,
        acceptRelationId,
        declineRelationId,
      };
    });

    const participantError = "Complete your hackathon profile";
    const expectParticipantError = async (operation: Promise<unknown>) => {
      await expect(operation).rejects.toThrow(participantError);
    };

    await expectParticipantError(
      asOwner.mutation(api.ideas.create, {
        ...makeIdeaArgs(categoryId),
        hackathonId: protectedHackathonId,
        title: "Blocked create",
      }),
    );
    await expectParticipantError(
      asOwner.mutation(api.ideas.update, {
        ideaId: seeded.sourceId,
        ...makeIdeaArgs(categoryId),
        title: "Blocked update",
      }),
    );
    await expectParticipantError(
      asOwner.mutation(api.ideas.remove, { ideaId: seeded.sourceId }),
    );

    await expectParticipantError(
      asOwner.mutation(api.memberships.join, { ideaId: seeded.sourceId }),
    );
    await expectParticipantError(
      asOwner.mutation(api.memberships.leave, { ideaId: seeded.sourceId }),
    );
    await expectParticipantError(
      asOwner.mutation(api.memberships.updateMemberRoles, {
        ideaId: seeded.sourceId,
        targetUserId: targetOwnerId,
        memberRoles: ["developer"],
      }),
    );

    await expectParticipantError(
      asOwner.mutation(api.interest.express, { ideaId: seeded.sourceId }),
    );
    await expectParticipantError(
      asOwner.mutation(api.interest.remove, { ideaId: seeded.sourceId }),
    );
    await expectParticipantError(
      asOwner.mutation(api.reactions.toggle, {
        ideaId: seeded.sourceId,
        type: "interested",
      }),
    );

    await expectParticipantError(
      asOwner.mutation(api.resourceRequests.add, {
        ideaId: seeded.sourceId,
        tag: "server",
      }),
    );
    await expectParticipantError(
      asOwner.mutation(api.resourceRequests.resolve, {
        requestId: seeded.resourceRequestId,
      }),
    );
    await expectParticipantError(
      asOwner.mutation(api.resourceRequests.remove, {
        requestId: seeded.resourceRequestId,
      }),
    );

    await expectParticipantError(
      asOwner.mutation(api.relatedIdeas.markRelated, {
        ideaIdA: seeded.sourceId,
        ideaIdB: seeded.markTargetId,
        relationType: "duplicate",
      }),
    );
    await expectParticipantError(
      asOwner.mutation(api.relatedIdeas.requestMerge, {
        relationId: seeded.requestRelationId,
      }),
    );
    await expectParticipantError(
      asTarget.mutation(api.relatedIdeas.acceptMerge, {
        relationId: seeded.acceptRelationId,
      }),
    );
    await expectParticipantError(
      asTarget.mutation(api.relatedIdeas.declineMerge, {
        relationId: seeded.declineRelationId,
      }),
    );

    await expectParticipantError(
      asOwner.mutation(api.discover.dismissIdea, {
        ideaId: seeded.markTargetId,
      }),
    );
    await expectParticipantError(
      asOwner.mutation(api.discover.undoDismissIdea, {
        ideaId: seeded.sourceId,
      }),
    );
    await expectParticipantError(
      asOwner.mutation(api.discover.resetDismissedIdeas, {
        hackathonId: protectedHackathonId,
      }),
    );

    await expectParticipantError(
      asOwner.query(api.ideas.list, {
        hackathonId: protectedHackathonId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    );
    await expectParticipantError(
      asOwner.query(api.ideas.listByCategory, {
        hackathonId: protectedHackathonId,
        categoryId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    );
    await expectParticipantError(
      asOwner.query(api.ideas.get, {
        ideaId: seeded.sourceId,
        hackathonId: protectedHackathonId,
      }),
    );
    await expectParticipantError(
      asOwner.query(api.discover.getDiscoverFeed, {
        hackathonId: protectedHackathonId,
      }),
    );
    await expectParticipantError(
      asOwner.query(api.users.listAll, {
        hackathonId: protectedHackathonId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    );
    await expectParticipantError(
      asOwner.query(api.comments.list, {
        ideaId: seeded.sourceId,
        hackathonId: protectedHackathonId,
      }),
    );
    await expectParticipantError(
      asOwner.query(api.reactions.getByIdea, {
        ideaId: seeded.sourceId,
      }),
    );
    await expectParticipantError(
      asOwner.query(api.relatedIdeas.listForIdea, {
        ideaId: seeded.sourceId,
      }),
    );
    await expectParticipantError(
      asOwner.query(api.relatedIdeas.searchPotentialDuplicates, {
        ideaId: seeded.sourceId,
      }),
    );
    await expectParticipantError(
      asOwner.query(api.resourceRequests.getAllUnresolved, {
        hackathonId: protectedHackathonId,
      }),
    );

    const unchanged = await t.run(async (ctx: any) => ({
      ideaCount: (
        await ctx.db
          .query("ideas")
          .withIndex("by_hackathon", (q: any) =>
            q.eq("hackathonId", protectedHackathonId),
          )
          .collect()
      ).length,
      source: await ctx.db.get(seeded.sourceId),
      ownerMembership: await ctx.db.get(seeded.ownerMembershipId),
      targetMembership: await ctx.db.get(seeded.targetMembershipId),
      interest: await ctx.db.get(seeded.interestId),
      resourceRequest: await ctx.db.get(seeded.resourceRequestId),
      dismissal: await ctx.db.get(seeded.dismissalId),
      requestRelation: await ctx.db.get(seeded.requestRelationId),
      acceptRelation: await ctx.db.get(seeded.acceptRelationId),
      declineRelation: await ctx.db.get(seeded.declineRelationId),
      membershipCount: (
        await ctx.db
          .query("ideaMembers")
          .withIndex("by_idea", (q: any) => q.eq("ideaId", seeded.sourceId))
          .collect()
      ).length,
      interestCount: (
        await ctx.db
          .query("ideaInterest")
          .withIndex("by_idea", (q: any) => q.eq("ideaId", seeded.sourceId))
          .collect()
      ).length,
      resourceCount: (
        await ctx.db
          .query("resourceRequests")
          .withIndex("by_idea", (q: any) => q.eq("ideaId", seeded.sourceId))
          .collect()
      ).length,
      relationCount: (await ctx.db.query("relatedIdeas").collect()).length,
      dismissalCount: (await ctx.db.query("dismissedIdeas").collect()).length,
      reactionCount: (
        await ctx.db
          .query("reactions")
          .withIndex("by_idea", (q: any) => q.eq("ideaId", seeded.sourceId))
          .collect()
      ).length,
      deletionJob: await ctx.db
        .query("ideaDeletionJobs")
        .withIndex("by_idea", (q: any) => q.eq("ideaId", seeded.sourceId))
        .unique(),
    }));

    expect(unchanged.ideaCount).toBe(5);
    expect(unchanged.source?.title).toBe("Matrix source");
    expect(unchanged.ownerMembership?.memberRoles).toEqual(["developer"]);
    expect(unchanged.targetMembership?.memberRoles).toEqual(["designer"]);
    expect(unchanged.interest).not.toBeNull();
    expect(unchanged.resourceRequest).toMatchObject({ resolved: false });
    expect(unchanged.dismissal).not.toBeNull();
    expect(unchanged.requestRelation?.mergeStatus).toBeUndefined();
    expect(unchanged.acceptRelation?.mergeStatus).toBe("pending");
    expect(unchanged.declineRelation?.mergeStatus).toBe("pending");
    expect(unchanged.membershipCount).toBe(2);
    expect(unchanged.interestCount).toBe(1);
    expect(unchanged.resourceCount).toBe(1);
    expect(unchanged.relationCount).toBe(3);
    expect(unchanged.dismissalCount).toBe(1);
    expect(unchanged.reactionCount).toBe(0);
    expect(unchanged.deletionJob).toBeNull();
  });

  test("secondary idea reads remain hidden while voting is active", async () => {
    const t = initTest();
    const email = `secondary-read-voter@${DOMAIN}`;
    const userId = await insertUser(t, { email });
    const actingUser = asUser(t, userId, email);
    const hackathonId = await seedHackathon(t, userId, "secondary-read-voting");
    await seedParticipant(t, hackathonId, userId);
    const ideaId = await seedIdea(t, userId, "Voting-hidden idea", hackathonId);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("comments", {
        hackathonId,
        ideaId,
        userId,
        content: "Hidden comment",
      });
      await ctx.db.insert("reactions", {
        hackathonId,
        ideaId,
        userId,
        type: "interested",
      });
      await ctx.db.insert("resourceRequests", {
        hackathonId,
        ideaId,
        tag: "server",
        resolved: false,
      });
      await ctx.db.insert("votingSettings", {
        hackathonId,
        key: "main",
        active: true,
        currentRound: 1,
        updatedBy: userId,
        updatedAt: Date.now(),
      });
    });

    const votingError = "Voting is active";
    await expect(
      actingUser.query(api.comments.list, { ideaId, hackathonId }),
    ).rejects.toThrow(votingError);
    await expect(
      actingUser.query(api.reactions.getByIdea, { ideaId }),
    ).rejects.toThrow(votingError);
    await expect(
      actingUser.query(api.relatedIdeas.listForIdea, { ideaId }),
    ).rejects.toThrow(votingError);
    await expect(
      actingUser.query(api.relatedIdeas.searchPotentialDuplicates, { ideaId }),
    ).rejects.toThrow(votingError);
    await expect(
      actingUser.query(api.resourceRequests.getAllUnresolved, { hackathonId }),
    ).rejects.toThrow(votingError);
  });
});
