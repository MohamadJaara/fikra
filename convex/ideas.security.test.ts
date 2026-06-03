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
} from "./testHelpers.test";

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

  test("authenticated users can navigate to adjacent ideas", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, { name: "Owner" });
    const ownerEmail = `owner5@${DOMAIN}`;
    await t.run(async (ctx: any) => {
      await ctx.db.patch(ownerId, { email: ownerEmail });
    });
    const asOwner = asUser(t, ownerId, ownerEmail);

    const olderIdeaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Older idea",
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const currentIdeaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Current idea",
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const newerIdeaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Newer idea",
    });

    const navigation = await asOwner.query(api.ideas.getAdjacent, {
      ideaId: currentIdeaId,
    });

    expect(navigation.previous?._id).toBe(newerIdeaId);
    expect(navigation.previous?.title).toBe("Newer idea");
    expect(navigation.next?._id).toBe(olderIdeaId);
    expect(navigation.next?.title).toBe("Older idea");
  });

  test("idea lists hide shelved ideas by default and expose the shelved view", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, { name: "Owner" });
    const ownerEmail = `owner6@${DOMAIN}`;
    await t.run(async (ctx: any) => {
      await ctx.db.patch(ownerId, { email: ownerEmail });
    });
    const asOwner = asUser(t, ownerId, ownerEmail);

    const activeIdeaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Active idea",
    });
    const shelvedIdeaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Shelved idea",
    });
    await asOwner.mutation(api.ideas.shelve, { ideaId: shelvedIdeaId });

    const defaultList = await asOwner.query(api.ideas.list, {
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(defaultList.page.map((idea) => idea._id)).toEqual([activeIdeaId]);

    const defaultCount = await asOwner.query(api.ideas.count, {});
    expect(defaultCount).toBe(1);

    const shelvedList = await asOwner.query(api.ideas.list, {
      paginationOpts: { numItems: 100, cursor: null },
      filters: { shelf: "shelved" },
    });
    expect(shelvedList.page.map((idea) => idea._id)).toEqual([shelvedIdeaId]);

    const shelvedCount = await asOwner.query(api.ideas.count, {
      filters: { shelf: "shelved" },
    });
    expect(shelvedCount).toBe(1);
  });
});
