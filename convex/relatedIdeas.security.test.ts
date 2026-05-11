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

describe("Related idea merges", () => {
  test("merge preserves target owner when they joined the source idea", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const sourceOwnerId = await insertUser(t, {
      name: "Source Owner",
      email: `source-owner@${DOMAIN}`,
    });
    const asSourceOwner = asUser(
      t,
      sourceOwnerId,
      `source-owner@${DOMAIN}`,
    );
    const sourceId = await asSourceOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Source idea",
    });

    const targetOwnerId = await insertUser(t, {
      name: "Target Owner",
      email: `target-owner@${DOMAIN}`,
    });
    const asTargetOwner = asUser(
      t,
      targetOwnerId,
      `target-owner@${DOMAIN}`,
    );
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
});
