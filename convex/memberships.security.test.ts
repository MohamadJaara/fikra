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
  test("owner cannot leave their own idea", async () => {
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
    ).rejects.toThrow("Owner cannot leave their own idea");
  });

  test("cannot join an idea twice", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownerm2@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownerm2@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    await expect(
      asOwner.mutation(api.memberships.join, { ideaId }),
    ).rejects.toThrow("Already a member");
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
