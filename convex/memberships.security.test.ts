/// <reference types="vite/client" />
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import {
  initTest,
  insertUser,
  asUser,
  makeIdeaArgs,
  seedCategory,
  seedRoles,
  DOMAIN,
} from "./testHelpers.test";

describe("Membership authorization", () => {
  test("owner is not a member until they explicitly join", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownerm@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownerm@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    await expect(
      asOwner.mutation(api.memberships.leave, { ideaId }),
    ).rejects.toThrow("Not a member");
  });

  test("owner can explicitly join their own idea only once", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownerm2@${DOMAIN}`,
      handle: "ownerm2",
    });
    const asOwner = asUser(t, ownerId, `ownerm2@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    await asOwner.mutation(api.memberships.join, { ideaId });

    const idea = await asOwner.query(api.ideas.get, { ideaId });
    expect(idea?.memberCount).toBe(1);
    expect(idea?.isMember).toBe(true);
    const profile = await asOwner.query(api.users.getProfile, {
      handle: "ownerm2",
    });
    expect(profile?.joinedIdeas.map((joined) => joined._id)).toContain(ideaId);

    await expect(
      asOwner.mutation(api.memberships.join, { ideaId }),
    ).rejects.toThrow("Already a member");

    await asOwner.mutation(api.memberships.leave, { ideaId });
    const afterLeave = await asOwner.query(api.ideas.get, { ideaId });
    expect(afterLeave?.memberCount).toBe(0);
    expect(afterLeave?.isMember).toBe(false);
  });

  test("only idea owner can update member roles", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    await seedRoles(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownerm3@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownerm3@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const memberId = await insertUser(t, {
      name: "Member",
      email: `memberm@${DOMAIN}`,
    });
    const asMember = asUser(t, memberId, `memberm@${DOMAIN}`);

    await asMember.mutation(api.memberships.join, { ideaId });

    await expect(
      asMember.mutation(api.memberships.updateMemberRoles, {
        ideaId,
        targetUserId: memberId,
        memberRoles: ["developer"],
      }),
    ).rejects.toThrow("Only the idea owner can update member roles");
  });
});
