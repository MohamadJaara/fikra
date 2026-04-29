/// <reference types="vite/client" />
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import {
  initTest,
  insertUser,
  asUser,
  makeIdeaArgs,
  seedCategory,
  DOMAIN,
} from "./testHelpers";

describe("Owner-only idea mutations", () => {
  test("non-owner cannot update an idea", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, { name: "Owner" });
    const ownerEmail = `owner@${DOMAIN}`;
    await t.run(async (ctx: any) => {
      await ctx.db.patch(ownerId, { email: ownerEmail });
    });
    const asOwner = asUser(t, ownerId, ownerEmail);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const otherId = await insertUser(t, {
      name: "Other",
      email: `other@${DOMAIN}`,
    });
    const asOther = asUser(t, otherId, `other@${DOMAIN}`);

    await expect(
      asOther.mutation(api.ideas.update, {
        ideaId,
        ...makeIdeaArgs(categoryId),
        title: "Hacked Title",
      }),
    ).rejects.toThrow("Only the owner can edit");
  });

  test("non-owner cannot delete an idea", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, { name: "Owner" });
    const ownerEmail = `owner2@${DOMAIN}`;
    await t.run(async (ctx: any) => {
      await ctx.db.patch(ownerId, { email: ownerEmail });
    });
    const asOwner = asUser(t, ownerId, ownerEmail);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const otherId = await insertUser(t, {
      name: "Other",
      email: `other2@${DOMAIN}`,
    });
    const asOther = asUser(t, otherId, `other2@${DOMAIN}`);

    await expect(
      asOther.mutation(api.ideas.remove, { ideaId }),
    ).rejects.toThrow("Only the owner can delete");
  });

  test("owner can update their own idea", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, { name: "Owner" });
    const ownerEmail = `owner3@${DOMAIN}`;
    await t.run(async (ctx: any) => {
      await ctx.db.patch(ownerId, { email: ownerEmail });
    });
    const asOwner = asUser(t, ownerId, ownerEmail);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    await asOwner.mutation(api.ideas.update, {
      ideaId,
      ...makeIdeaArgs(categoryId),
      title: "Updated Title",
    });

    const idea = await asOwner.query(api.ideas.get, { ideaId });
    expect(idea?.title).toBe("Updated Title");
  });

  test("owner can delete their own idea", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, { name: "Owner" });
    const ownerEmail = `owner4@${DOMAIN}`;
    await t.run(async (ctx: any) => {
      await ctx.db.patch(ownerId, { email: ownerEmail });
    });
    const asOwner = asUser(t, ownerId, ownerEmail);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    await expect(
      asOwner.mutation(api.ideas.remove, { ideaId }),
    ).resolves.toBeDefined();
  });
});
