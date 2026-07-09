/// <reference types="vite/client" />
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  initTest,
  insertUser,
  asUser,
  makeIdeaArgs,
  seedCategory,
  DOMAIN,
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

async function seedScopedCategory(
  t: TestContext,
  hackathonId: Id<"hackathons">,
  slug: string,
) {
  return (await t.run(async (ctx: any) => {
    return await ctx.db.insert("categories", {
      hackathonId,
      name: slug,
      slug,
    });
  })) as Id<"categories">;
}

async function getOnlyRelationId(t: TestContext) {
  return (await t.run(async (ctx: any) => {
    const relations = await ctx.db.query("relatedIdeas").collect();
    return relations[0]._id;
  })) as Id<"relatedIdeas">;
}

describe("Related idea merges", () => {
  test("merge preserves target owner when they joined the source idea", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const sourceOwnerId = await insertUser(t, {
      name: "Source Owner",
      email: `source-owner@${DOMAIN}`,
    });
    const asSourceOwner = asUser(t, sourceOwnerId, `source-owner@${DOMAIN}`);
    const sourceId = await asSourceOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Source idea",
    });

    const targetOwnerId = await insertUser(t, {
      name: "Target Owner",
      email: `target-owner@${DOMAIN}`,
    });
    const asTargetOwner = asUser(t, targetOwnerId, `target-owner@${DOMAIN}`);
    const targetId = await asTargetOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Target idea",
    });

    await asTargetOwner.mutation(api.memberships.join, { ideaId: sourceId });

    await asSourceOwner.mutation(api.relatedIdeas.markRelated, {
      ideaIdA: sourceId,
      ideaIdB: targetId,
      relationType: "duplicate",
    });
    const relationId = (await t.run(async (ctx: any) => {
      const relations = await ctx.db.query("relatedIdeas").collect();
      return relations[0]._id;
    })) as Id<"relatedIdeas">;

    await asSourceOwner.mutation(api.relatedIdeas.requestMerge, { relationId });
    await asTargetOwner.mutation(api.relatedIdeas.acceptMerge, { relationId });

    const targetIdea = await asTargetOwner.query(api.ideas.get, {
      ideaId: targetId,
    });
    expect(targetIdea?.isOwner).toBe(true);
    expect(targetIdea?.isMember).toBe(true);
    expect(targetIdea?.memberCount).toBe(1);
    expect(targetIdea?.members.map((member) => member.userId)).toContain(
      targetOwnerId,
    );
  });

  test("only an owner can relate ideas and new relations inherit the hackathon", async () => {
    const t = initTest();
    const ownerAEmail = `relation-owner-a@${DOMAIN}`;
    const ownerBEmail = `relation-owner-b@${DOMAIN}`;
    const outsiderEmail = `relation-outsider@${DOMAIN}`;
    const ownerAId = await insertUser(t, { email: ownerAEmail });
    const ownerBId = await insertUser(t, { email: ownerBEmail });
    const outsiderId = await insertUser(t, { email: outsiderEmail });
    const asOwnerA = asUser(t, ownerAId, ownerAEmail);
    const asOwnerB = asUser(t, ownerBId, ownerBEmail);
    const asOutsider = asUser(t, outsiderId, outsiderEmail);
    const hackathonId = await seedHackathon(t, ownerAId, "relation-ownership");
    const categoryId = await seedScopedCategory(
      t,
      hackathonId,
      "relation-ownership-category",
    );
    const ideaA = await asOwnerA.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      hackathonId,
      title: "Owner A idea",
    });
    const ideaB = await asOwnerB.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      hackathonId,
      title: "Owner B idea",
    });

    await expect(
      asOutsider.mutation(api.relatedIdeas.markRelated, {
        ideaIdA: ideaA,
        ideaIdB: ideaB,
        relationType: "related",
      }),
    ).rejects.toThrow("Only idea owners can relate ideas");

    await asOwnerB.mutation(api.relatedIdeas.markRelated, {
      ideaIdA: ideaA,
      ideaIdB: ideaB,
      relationType: "related",
    });

    const relation = await t.run(async (ctx: any) => {
      return await ctx.db.query("relatedIdeas").first();
    });
    expect(relation?.hackathonId).toBe(hackathonId);
    expect(relation?.markedByUserId).toBe(ownerBId);
  });

  test("cross-hackathon and corrupt legacy relations fail closed", async () => {
    const t = initTest();
    const sourceEmail = `cross-source@${DOMAIN}`;
    const targetEmail = `cross-target@${DOMAIN}`;
    const sourceOwnerId = await insertUser(t, { email: sourceEmail });
    const targetOwnerId = await insertUser(t, { email: targetEmail });
    const asSource = asUser(t, sourceOwnerId, sourceEmail);
    const asTarget = asUser(t, targetOwnerId, targetEmail);
    const hackathonA = await seedHackathon(t, sourceOwnerId, "cross-event-a");
    const hackathonB = await seedHackathon(t, targetOwnerId, "cross-event-b");
    const categoryA = await seedScopedCategory(
      t,
      hackathonA,
      "cross-event-a-category",
    );
    const categoryB = await seedScopedCategory(
      t,
      hackathonB,
      "cross-event-b-category",
    );
    const ideaA = await asSource.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryA),
      hackathonId: hackathonA,
      title: "Cross event source",
    });
    const ideaB = await asTarget.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryB),
      hackathonId: hackathonB,
      title: "Cross event target",
    });

    await expect(
      asSource.mutation(api.relatedIdeas.markRelated, {
        ideaIdA: ideaA,
        ideaIdB: ideaB,
        relationType: "duplicate",
      }),
    ).rejects.toThrow("Ideas must belong to the same hackathon");

    const relationIds = (await t.run(async (ctx: any) => {
      const base = {
        hackathonId: hackathonA,
        ideaIdA: ideaA,
        ideaIdB: ideaB,
        markedByUserId: sourceOwnerId,
        relationType: "duplicate",
      };
      return {
        remove: await ctx.db.insert("relatedIdeas", base),
        request: await ctx.db.insert("relatedIdeas", base),
        accept: await ctx.db.insert("relatedIdeas", {
          ...base,
          mergeRequestedById: sourceOwnerId,
          mergeStatus: "pending",
        }),
        decline: await ctx.db.insert("relatedIdeas", {
          ...base,
          mergeRequestedById: sourceOwnerId,
          mergeStatus: "pending",
        }),
      };
    })) as Record<string, Id<"relatedIdeas">>;

    await expect(
      asSource.mutation(api.relatedIdeas.removeRelation, {
        relationId: relationIds.remove,
      }),
    ).rejects.toThrow("Ideas must belong to the same hackathon");
    await expect(
      asSource.mutation(api.relatedIdeas.requestMerge, {
        relationId: relationIds.request,
      }),
    ).rejects.toThrow("Ideas must belong to the same hackathon");
    await expect(
      asTarget.mutation(api.relatedIdeas.acceptMerge, {
        relationId: relationIds.accept,
      }),
    ).rejects.toThrow("Ideas must belong to the same hackathon");
    await expect(
      asTarget.mutation(api.relatedIdeas.declineMerge, {
        relationId: relationIds.decline,
      }),
    ).rejects.toThrow("Ideas must belong to the same hackathon");

    const listed = await asSource.query(api.relatedIdeas.listForIdea, {
      ideaId: ideaA,
    });
    expect(listed).toEqual([]);
  });

  test("relation mutations respect completed and voting-locked hackathons", async () => {
    const t = initTest();
    const sourceEmail = `locked-source@${DOMAIN}`;
    const targetEmail = `locked-target@${DOMAIN}`;
    const sourceOwnerId = await insertUser(t, {
      email: sourceEmail,
      isAdmin: true,
    });
    const targetOwnerId = await insertUser(t, { email: targetEmail });
    const asSource = asUser(t, sourceOwnerId, sourceEmail);
    const asTarget = asUser(t, targetOwnerId, targetEmail);
    const hackathonId = await seedHackathon(t, sourceOwnerId, "locked-event");
    const categoryId = await seedScopedCategory(
      t,
      hackathonId,
      "locked-event-category",
    );
    const sourceId = await asSource.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      hackathonId,
      title: "Locked source idea",
    });
    const targetId = await asTarget.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      hackathonId,
      title: "Locked target idea",
    });
    await asSource.mutation(api.relatedIdeas.markRelated, {
      ideaIdA: sourceId,
      ideaIdB: targetId,
      relationType: "duplicate",
    });
    const relationId = await getOnlyRelationId(t);

    await t.run(async (ctx: any) => {
      await ctx.db.patch(hackathonId, { status: "completed" });
    });
    await expect(
      asSource.mutation(api.relatedIdeas.removeRelation, { relationId }),
    ).rejects.toThrow("This hackathon is read-only");
    await expect(
      asSource.mutation(api.relatedIdeas.requestMerge, { relationId }),
    ).rejects.toThrow("This hackathon is read-only");

    await t.run(async (ctx: any) => {
      await ctx.db.patch(hackathonId, { status: "active" });
      await ctx.db.insert("votingSettings", {
        hackathonId,
        key: "main",
        active: true,
        currentRound: 1,
        updatedBy: sourceOwnerId,
        updatedAt: Date.now(),
      });
      await ctx.db.patch(relationId, {
        mergeRequestedById: sourceOwnerId,
        mergeStatus: "pending",
      });
    });

    await expect(
      asSource.mutation(api.relatedIdeas.removeRelation, { relationId }),
    ).rejects.toThrow("Voting is active");
    await expect(
      asSource.mutation(api.relatedIdeas.requestMerge, { relationId }),
    ).rejects.toThrow("Voting is active");
    await expect(
      asTarget.mutation(api.relatedIdeas.acceptMerge, { relationId }),
    ).rejects.toThrow("Voting is active");
    await expect(
      asTarget.mutation(api.relatedIdeas.declineMerge, { relationId }),
    ).rejects.toThrow("Voting is active");
    await expect(
      asSource.query(api.relatedIdeas.searchPotentialDuplicates, {
        ideaId: sourceId,
      }),
    ).rejects.toThrow("Voting is active");
    await expect(
      asSource.query(api.relatedIdeas.listForIdea, { ideaId: sourceId }),
    ).rejects.toThrow("Voting is active");
  });

  test("duplicate search is limited to the idea hackathon", async () => {
    const t = initTest();
    const ownerEmail = `search-owner@${DOMAIN}`;
    const otherEmail = `search-other@${DOMAIN}`;
    const ownerId = await insertUser(t, { email: ownerEmail });
    const otherId = await insertUser(t, { email: otherEmail });
    const asOwner = asUser(t, ownerId, ownerEmail);
    const asOther = asUser(t, otherId, otherEmail);
    const hackathonA = await seedHackathon(t, ownerId, "search-event-a");
    const hackathonB = await seedHackathon(t, ownerId, "search-event-b");
    const categoryA = await seedScopedCategory(
      t,
      hackathonA,
      "search-event-a-category",
    );
    const categoryB = await seedScopedCategory(
      t,
      hackathonB,
      "search-event-b-category",
    );
    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryA),
      hackathonId: hackathonA,
      title: "Climate Water Platform",
    });
    const sameEventId = await asOther.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryA),
      hackathonId: hackathonA,
      title: "Climate Water Explorer",
    });
    const otherEventId = await asOther.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryB),
      hackathonId: hackathonB,
      title: "Climate Water Global",
    });

    const results = await asOwner.query(
      api.relatedIdeas.searchPotentialDuplicates,
      { ideaId },
    );
    expect(results.map((result) => result._id)).toContain(sameEventId);
    expect(results.map((result) => result._id)).not.toContain(otherEventId);
  });

  test("merge transfers carry and repair the target hackathon scope", async () => {
    const t = initTest();
    const sourceEmail = `scoped-source@${DOMAIN}`;
    const targetEmail = `scoped-target@${DOMAIN}`;
    const memberEmail = `scoped-member@${DOMAIN}`;
    const interestedEmail = `scoped-interested@${DOMAIN}`;
    const sourceOwnerId = await insertUser(t, { email: sourceEmail });
    const targetOwnerId = await insertUser(t, { email: targetEmail });
    const memberId = await insertUser(t, { email: memberEmail });
    const interestedId = await insertUser(t, { email: interestedEmail });
    const asSource = asUser(t, sourceOwnerId, sourceEmail);
    const asTarget = asUser(t, targetOwnerId, targetEmail);
    const asMember = asUser(t, memberId, memberEmail);
    const asInterested = asUser(t, interestedId, interestedEmail);
    const hackathonId = await seedHackathon(t, sourceOwnerId, "scoped-merge");
    const categoryId = await seedScopedCategory(
      t,
      hackathonId,
      "scoped-merge-category",
    );
    const sourceId = await asSource.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      hackathonId,
      title: "Scoped source",
    });
    const targetId = await asTarget.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      hackathonId,
      title: "Scoped target",
    });
    await asMember.mutation(api.memberships.join, { ideaId: sourceId });
    await asInterested.mutation(api.interest.express, { ideaId: sourceId });
    await t.run(async (ctx: any) => {
      await ctx.db.insert("ideaInterest", {
        ideaId: targetId,
        userId: interestedId,
      });
      await ctx.db.insert("dismissedIdeas", {
        hackathonId,
        ideaId: sourceId,
        userId: interestedId,
      });
      await ctx.db.insert("ideaBookmarks", {
        hackathonId,
        ideaId: sourceId,
        userId: interestedId,
      });
      await ctx.db.insert("ideaVotes", {
        hackathonId,
        ideaId: sourceId,
        userId: interestedId,
        round: 1,
        createdAt: Date.now(),
      });
    });

    await asSource.mutation(api.relatedIdeas.markRelated, {
      ideaIdA: sourceId,
      ideaIdB: targetId,
      relationType: "duplicate",
    });
    const relationId = await getOnlyRelationId(t);
    const relationHackathonId = await t.run(async (ctx: any) => {
      return (await ctx.db.get(relationId))?.hackathonId;
    });
    expect(relationHackathonId).toBe(hackathonId);

    await asSource.mutation(api.relatedIdeas.requestMerge, { relationId });
    await asTarget.mutation(api.relatedIdeas.acceptMerge, { relationId });

    const transferred = await t.run(async (ctx: any) => {
      const member = await ctx.db
        .query("ideaMembers")
        .withIndex("by_idea_and_user", (q: any) =>
          q.eq("ideaId", targetId).eq("userId", memberId),
        )
        .first();
      const interest = await ctx.db
        .query("ideaInterest")
        .withIndex("by_idea_and_user", (q: any) =>
          q.eq("ideaId", targetId).eq("userId", interestedId),
        )
        .first();
      const dismissals = await ctx.db
        .query("dismissedIdeas")
        .withIndex("by_idea_and_user", (q: any) => q.eq("ideaId", sourceId))
        .collect();
      const bookmarks = await ctx.db
        .query("ideaBookmarks")
        .withIndex("by_idea", (q: any) => q.eq("ideaId", sourceId))
        .collect();
      const votes = await ctx.db
        .query("ideaVotes")
        .withIndex("by_idea_and_round", (q: any) => q.eq("ideaId", sourceId))
        .collect();
      return {
        member,
        interest,
        source: await ctx.db.get(sourceId),
        dismissals,
        bookmarks,
        votes,
      };
    });
    expect(transferred.member?.hackathonId).toBe(hackathonId);
    expect(transferred.interest?.hackathonId).toBe(hackathonId);
    expect(transferred.source).toBeNull();
    expect(transferred.dismissals).toHaveLength(0);
    expect(transferred.bookmarks).toHaveLength(0);
    expect(transferred.votes).toHaveLength(0);
  });

  test("every relation mutation rejects an authenticated wrong actor", async () => {
    const t = initTest();
    const sourceEmail = `actor-source@${DOMAIN}`;
    const targetEmail = `actor-target@${DOMAIN}`;
    const outsiderEmail = `actor-outsider@${DOMAIN}`;
    const sourceOwnerId = await insertUser(t, { email: sourceEmail });
    const targetOwnerId = await insertUser(t, { email: targetEmail });
    const outsiderId = await insertUser(t, { email: outsiderEmail });
    const asSource = asUser(t, sourceOwnerId, sourceEmail);
    const asTarget = asUser(t, targetOwnerId, targetEmail);
    const asOutsider = asUser(t, outsiderId, outsiderEmail);
    const categoryId = await seedCategory(t);
    const sourceId = await asSource.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Actor source idea",
    });
    const targetId = await asTarget.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Actor target idea",
    });
    await asSource.mutation(api.relatedIdeas.markRelated, {
      ideaIdA: sourceId,
      ideaIdB: targetId,
      relationType: "duplicate",
    });
    const relationId = await getOnlyRelationId(t);

    await expect(
      asOutsider.mutation(api.relatedIdeas.removeRelation, { relationId }),
    ).rejects.toThrow("Only idea owners can remove relations");
    await expect(
      asOutsider.mutation(api.relatedIdeas.requestMerge, { relationId }),
    ).rejects.toThrow("Only an idea owner can request a merge");

    await asSource.mutation(api.relatedIdeas.requestMerge, { relationId });

    await expect(
      asSource.mutation(api.relatedIdeas.acceptMerge, { relationId }),
    ).rejects.toThrow("Only the owner of the target idea can accept the merge");
    await expect(
      asSource.mutation(api.relatedIdeas.declineMerge, { relationId }),
    ).rejects.toThrow(
      "Only the owner of the target idea can decline the merge",
    );
    await expect(
      asOutsider.mutation(api.relatedIdeas.acceptMerge, { relationId }),
    ).rejects.toThrow("Only the owner of the target idea can accept the merge");
    await expect(
      asOutsider.mutation(api.relatedIdeas.declineMerge, { relationId }),
    ).rejects.toThrow(
      "Only the owner of the target idea can decline the merge",
    );
  });

  test("unscoped duplicate search is not crowded out by scoped matches", async () => {
    const t = initTest();
    const ownerEmail = `legacy-search-owner@${DOMAIN}`;
    const ownerId = await insertUser(t, { email: ownerEmail });
    const asOwner = asUser(t, ownerId, ownerEmail);
    const scopedHackathonId = await seedHackathon(
      t,
      ownerId,
      "legacy-search-distractors",
    );

    const { ideaId, expectedMatchId } = await t.run(async (ctx: any) => {
      const ideaFields = {
        pitch: "A climate water collaboration platform",
        problem: "Climate water coordination",
        targetAudience: "Hackathon participants",
        skillsNeeded: [],
        teamSize: "small",
        status: "exploring",
        lookingForRoles: [],
        ownerId,
      };

      for (let index = 0; index < 110; index += 1) {
        await ctx.db.insert("ideas", {
          ...ideaFields,
          hackathonId: scopedHackathonId,
          title: `Climate Water Platform ${index}`,
        });
      }

      const expectedMatchId = await ctx.db.insert("ideas", {
        ...ideaFields,
        title: "Climate Water Legacy Match",
      });
      const ideaId = await ctx.db.insert("ideas", {
        ...ideaFields,
        title: "Climate Water Legacy Platform",
      });
      return { ideaId, expectedMatchId };
    });

    const results = await asOwner.query(
      api.relatedIdeas.searchPotentialDuplicates,
      { ideaId },
    );
    expect(results.map((result) => result._id)).toContain(expectedMatchId);
    expect(results).toHaveLength(1);
  });
});
