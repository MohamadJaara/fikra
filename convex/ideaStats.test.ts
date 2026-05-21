/// <reference types="vite/client" />
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import {
  initTest,
  insertUser,
  asUser,
  makeIdeaArgs,
  seedCategory,
  seedResources,
  seedRoles,
  DOMAIN,
} from "./testHelpers.test";

describe("Denormalized idea stats", () => {
  test("auto-detects formed teams and queues a room request", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `formed-owner@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `formed-owner@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const firstMemberId = await insertUser(t, {
      name: "First Member",
      email: `formed-first@${DOMAIN}`,
    });
    const secondMemberId = await insertUser(t, {
      name: "Second Member",
      email: `formed-second@${DOMAIN}`,
    });

    await asUser(t, firstMemberId, `formed-first@${DOMAIN}`).mutation(
      api.memberships.join,
      { ideaId },
    );

    let idea = await asOwner.query(api.ideas.get, { ideaId });
    expect(idea?.teamFormationStatus).toBe("forming");
    expect(idea?.roomRequestStatus).toBe("none");

    await asUser(t, secondMemberId, `formed-second@${DOMAIN}`).mutation(
      api.memberships.join,
      { ideaId },
    );

    idea = await asOwner.query(api.ideas.get, { ideaId });
    expect(idea?.memberCount).toBe(2);
    expect(idea?.teamFormationStatus).toBe("formed");
    expect(idea?.teamFormationSource).toBe("auto");
    expect(idea?.roomRequestStatus).toBe("requested");
    expect(idea?.roomRequestedAt).toBeTypeOf("number");
  });

  test("owners can manually mark a team formed", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `manual-owner@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `manual-owner@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const otherId = await insertUser(t, {
      name: "Other",
      email: `manual-other@${DOMAIN}`,
    });
    const asOther = asUser(t, otherId, `manual-other@${DOMAIN}`);

    await expect(
      asOther.mutation(api.ideas.markTeamFormed, { ideaId }),
    ).rejects.toThrow("Only the owner can mark the team formed");

    await asOwner.mutation(api.ideas.markTeamFormed, { ideaId });

    const idea = await asOwner.query(api.ideas.get, { ideaId });
    expect(idea?.teamFormationStatus).toBe("formed");
    expect(idea?.teamFormationSource).toBe("owner");
    expect(idea?.roomRequestStatus).toBe("requested");
  });

  test("keeps list stats in sync with mutations", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    await seedRoles(t);
    await seedResources(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `stats-owner@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `stats-owner@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      lookingForRoles: ["developer"],
      resourceTags: ["linux_vps"],
    });

    let storedIdea = await t.run(async (ctx: any) => {
      return await ctx.db.get(ideaId);
    });
    expect(storedIdea.memberCount).toBe(0);
    expect(storedIdea.interestCount).toBe(0);
    expect(storedIdea.reactionCounts).toEqual({});
    expect(storedIdea.resourceRequestCount).toBe(1);
    expect(storedIdea.hasUnresolvedResources).toBe(true);
    expect(storedIdea.resourceRequestSummary).toHaveLength(1);

    const otherId = await insertUser(t, {
      name: "Other",
      email: `stats-other@${DOMAIN}`,
    });
    const asOther = asUser(t, otherId, `stats-other@${DOMAIN}`);

    await asOther.mutation(api.memberships.join, {
      ideaId,
      memberRoles: ["developer"],
    });
    await asOther.mutation(api.interest.express, { ideaId });
    await asOther.mutation(api.reactions.toggle, {
      ideaId,
      type: "exciting",
    });

    const listForOther = await asOther.query(api.ideas.list, {
      paginationOpts: { numItems: 100, cursor: null },
    });
    const listed = listForOther.page.find((idea) => idea._id === ideaId);
    expect(listed?.memberCount).toBe(1);
    expect(listed?.interestCount).toBe(1);
    expect(listed?.reactionCounts).toEqual({ exciting: 1 });
    expect(listed?.userReactions).toEqual(["exciting"]);
    expect(listed?.missingRoles).toEqual([]);
    expect(listed?.hasUnresolvedResources).toBe(true);
    expect(listed?.resourceRequests).toHaveLength(1);

    const requestId = await t.run(async (ctx: any) => {
      const requests = await ctx.db
        .query("resourceRequests")
        .withIndex("by_idea", (q: any) => q.eq("ideaId", ideaId))
        .collect();
      return requests[0]._id;
    });

    await asOwner.mutation(api.resourceRequests.resolve, { requestId });
    await asOther.mutation(api.reactions.toggle, {
      ideaId,
      type: "exciting",
    });
    await asOther.mutation(api.interest.remove, { ideaId });
    await asOther.mutation(api.memberships.leave, { ideaId });

    storedIdea = await t.run(async (ctx: any) => {
      return await ctx.db.get(ideaId);
    });
    expect(storedIdea.memberCount).toBe(0);
    expect(storedIdea.interestCount).toBe(0);
    expect(storedIdea.reactionCounts).toEqual({});
    expect(storedIdea.hasUnresolvedResources).toBe(false);
    expect(storedIdea.resourceRequestSummary[0].resolved).toBe(true);

    const listForOwner = await asOwner.query(api.ideas.list, {
      paginationOpts: { numItems: 100, cursor: null },
    });
    const listedForOwner = listForOwner.page.find(
      (idea) => idea._id === ideaId,
    );
    expect(listedForOwner?.missingRoles).toEqual(["developer"]);
    expect(listedForOwner?.hasUnresolvedResources).toBe(false);
    expect(listedForOwner?.resourceRequests[0].resolved).toBe(true);
  });
});

describe("Denormalized notification counts", () => {
  test("keeps unread count in sync with notification mutations", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `notify-owner@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `notify-owner@${DOMAIN}`);
    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const otherId = await insertUser(t, {
      name: "Other",
      email: `notify-other@${DOMAIN}`,
    });
    const asOther = asUser(t, otherId, `notify-other@${DOMAIN}`);
    await asOther.mutation(api.interest.express, { ideaId });

    expect(await asOwner.query(api.notifications.unreadCount, {})).toBe(1);
    await asOwner.mutation(api.notifications.markAllRead, {});
    expect(await asOwner.query(api.notifications.unreadCount, {})).toBe(0);
  });
});
