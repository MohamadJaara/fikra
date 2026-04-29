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
  DOMAIN,
} from "./testHelpers";

describe("Input validation & enum enforcement", () => {
  test("rejects invalid status on idea creation", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const userId = await insertUser(t, {
      name: "User",
      email: `userv@${DOMAIN}`,
    });
    const asU = asUser(t, userId, `userv@${DOMAIN}`);

    await expect(
      asU.mutation(api.ideas.create, {
        ...makeIdeaArgs(categoryId),
        status: "admin",
      }),
    ).rejects.toThrow("Invalid status");
  });

  test("rejects invalid status on idea update", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const userId = await insertUser(t, {
      name: "User",
      email: `userv2@${DOMAIN}`,
    });
    const asU = asUser(t, userId, `userv2@${DOMAIN}`);

    const ideaId = await asU.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    await expect(
      asU.mutation(api.ideas.update, {
        ideaId,
        ...makeIdeaArgs(categoryId),
        status: "hacked",
      }),
    ).rejects.toThrow("Invalid status");
  });

  test("rejects title exceeding max length", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const userId = await insertUser(t, {
      name: "User",
      email: `userv3@${DOMAIN}`,
    });
    const asU = asUser(t, userId, `userv3@${DOMAIN}`);

    await expect(
      asU.mutation(api.ideas.create, {
        ...makeIdeaArgs(categoryId),
        title: "x".repeat(121),
      }),
    ).rejects.toThrow("Title must be at most 120 characters");
  });

  test("rejects empty title", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const userId = await insertUser(t, {
      name: "User",
      email: `userv4@${DOMAIN}`,
    });
    const asU = asUser(t, userId, `userv4@${DOMAIN}`);

    await expect(
      asU.mutation(api.ideas.create, {
        ...makeIdeaArgs(categoryId),
        title: "",
      }),
    ).rejects.toThrow("Title must be at least 1 characters");
  });

  test("rejects comment exceeding max length", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const userId = await insertUser(t, {
      name: "User",
      email: `userv5@${DOMAIN}`,
    });
    const asU = asUser(t, userId, `userv5@${DOMAIN}`);

    const ideaId = await asU.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    await expect(
      asU.mutation(api.comments.create, {
        ideaId,
        content: "x".repeat(2001),
      }),
    ).rejects.toThrow("Comment must be at most 2000 characters");
  });

  test("rejects invalid reaction type", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const userId = await insertUser(t, {
      name: "User",
      email: `userv6@${DOMAIN}`,
    });
    const asU = asUser(t, userId, `userv6@${DOMAIN}`);

    const ideaId = await asU.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    await expect(
      asU.mutation(api.reactions.toggle, {
        ideaId,
        type: "malicious",
      }),
    ).rejects.toThrow("Invalid reaction type");
  });

  test("rejects invalid resource slug", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const userId = await insertUser(t, {
      name: "User",
      email: `userv7@${DOMAIN}`,
    });
    const asU = asUser(t, userId, `userv7@${DOMAIN}`);

    await expect(
      asU.mutation(api.ideas.create, {
        ...makeIdeaArgs(categoryId),
        resourceTags: ["nonexistent_resource"],
      }),
    ).rejects.toThrow("Invalid resource");
  });
});

describe("Resource request authorization", () => {
  test("non-owner non-admin cannot add resource request", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    await seedResources(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownerr@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownerr@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const otherId = await insertUser(t, {
      name: "Other",
      email: `otherr@${DOMAIN}`,
    });
    const asOther = asUser(t, otherId, `otherr@${DOMAIN}`);

    await expect(
      asOther.mutation(api.resourceRequests.add, {
        ideaId,
        tag: "linux_vps",
      }),
    ).rejects.toThrow("Only the owner or an admin can add resource requests");
  });

  test("non-owner non-admin cannot resolve resource request", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    await seedResources(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownerr2@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownerr2@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      resourceTags: ["linux_vps"],
    });

    const requestId = await t.run(async (ctx: any) => {
      const reqs = await ctx.db
        .query("resourceRequests")
        .withIndex("by_idea", (q: any) => q.eq("ideaId", ideaId))
        .collect();
      return reqs[0]._id;
    });

    const otherId = await insertUser(t, {
      name: "Other",
      email: `otherr2@${DOMAIN}`,
    });
    const asOther = asUser(t, otherId, `otherr2@${DOMAIN}`);

    await expect(
      asOther.mutation(api.resourceRequests.resolve, { requestId }),
    ).rejects.toThrow("Only the owner or an admin can resolve resource requests");
  });
});

describe("Admin guard", () => {
  test("getAdminUser rejects non-admin", async () => {
    const t = initTest();
    const userId = await insertUser(t, {
      name: "NonAdmin",
      email: `nonadmin@${DOMAIN}`,
      isAdmin: false,
    });

    const asU = asUser(t, userId, `nonadmin@${DOMAIN}`);

    await expect(
      asU.run(async (ctx: any) => {
        const { getAdminUser } = await import("./lib");
        return await getAdminUser(ctx);
      }),
    ).rejects.toThrow("Admin access required");
  });
});
