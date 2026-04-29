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

describe("Notification authorization", () => {
  test("user cannot mark another user's notification as read", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownern@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownern@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const notificationId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("notifications", {
        recipientId: ownerId,
        actorId: ownerId,
        ideaId,
        type: "comment_added",
        read: false,
      });
    });

    const otherId = await insertUser(t, {
      name: "Other",
      email: `othern@${DOMAIN}`,
    });
    const asOther = asUser(t, otherId, `othern@${DOMAIN}`);

    await expect(
      asOther.mutation(api.notifications.markRead, { notificationId }),
    ).rejects.toThrow("Not your notification");
  });
});
