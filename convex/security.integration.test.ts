/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

const DOMAIN = "test.com";

async function insertUser(
  t: ReturnType<typeof convexTest>,
  overrides: Record<string, unknown> = {},
) {
  const id = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: `user${Date.now()}@${DOMAIN}`,
      emailVerificationTime: Date.now(),
      onboardingComplete: true,
      participationMode: "onsite",
      ...overrides,
    });
  });
  return id as Id<"users">;
}

function asUser(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  email: string,
) {
  return t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://convex.test",
    email,
  });
}

function makeIdeaArgs(categoryId: Id<"categories">) {
  return {
    title: "Test Idea",
    pitch: "A test pitch",
    problem: "A test problem",
    targetAudience: "Everyone",
    skillsNeeded: [],
    teamSize: "small" as const,
    status: "exploring",
    lookingForRoles: [],
    categoryId,
  };
}

async function seedCategory(t: ReturnType<typeof convexTest>) {
  return (await t.run(async (ctx: any) => {
    return await ctx.db.insert("categories", {
      name: "Test Category",
      slug: "test-category",
    });
  })) as Id<"categories">;
}

async function seedRoles(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("roles", { name: "Developer", slug: "developer" });
  });
}

async function seedResources(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("resources", { name: "Linux VPS", slug: "linux_vps" });
  });
}

async function getFirstCommentId(
  t: ReturnType<typeof convexTest>,
  ideaId: Id<"ideas">,
) {
  return (await t.run(async (ctx: any) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_idea", (q: any) => q.eq("ideaId", ideaId))
      .collect();
    return comments[0]._id;
  })) as Id<"comments">;
}

describe("Authentication & email domain gate", () => {
  test("unauthenticated user cannot create an idea", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
    const categoryId = await seedCategory(t);

    await expect(
      t.mutation(api.ideas.create, { ...makeIdeaArgs(categoryId) }),
    ).rejects.toThrow("Not authenticated");
  });

  test("unauthenticated query returns empty list", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
    const result = await t.query(api.ideas.list, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result).toEqual({ page: [], isDone: true, continueCursor: "" });
  });

  test("user with disallowed email is rejected", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
    const userId = await insertUser(t, { email: "hacker@evil.com" });
    const asHacker = asUser(t, userId, "hacker@evil.com");

    await expect(
      asHacker.mutation(api.ideas.create, {
        ...makeIdeaArgs(await seedCategory(t)),
      }),
    ).rejects.toThrow("Access denied");
  });
});

describe("Owner-only idea mutations", () => {
  test("non-owner cannot update an idea", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
      email: `other2@${DOMAIN}`,
    });
    const asOther = asUser(t, otherId, `other2@${DOMAIN}`);

    await expect(
      asOther.mutation(api.ideas.remove, { ideaId }),
    ).rejects.toThrow("Only the owner can delete");
  });

  test("owner can update their own idea", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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

describe("Comment authorization", () => {
  test("non-author cannot edit another user's comment", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
    const categoryId = await seedCategory(t);

    const authorId = await insertUser(t, {
      name: "Author",
      email: `author@${DOMAIN}`,
    });
    const asAuthor = asUser(t, authorId, `author@${DOMAIN}`);

    const ideaId = await asAuthor.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    await asAuthor.mutation(api.comments.create, {
      ideaId,
      content: "Original comment",
    });
    const commentId = await getFirstCommentId(t, ideaId);

    const otherId = await insertUser(t, {
      name: "Other",
      email: `commenter@${DOMAIN}`,
    });
    const asOther = asUser(t, otherId, `commenter@${DOMAIN}`);

    await expect(
      asOther.mutation(api.comments.update, {
        commentId,
        content: "Hacked!",
      }),
    ).rejects.toThrow("Can only edit your own comments");
  });

  test("idea owner can delete any comment on their idea", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownerc@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownerc@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const commenterId = await insertUser(t, {
      name: "Commenter",
      email: `commenter2@${DOMAIN}`,
    });
    const asCommenter = asUser(t, commenterId, `commenter2@${DOMAIN}`);

    await asCommenter.mutation(api.memberships.join, { ideaId });

    await asCommenter.mutation(api.comments.create, {
      ideaId,
      content: "A comment",
    });
    const commentId = await getFirstCommentId(t, ideaId);

    await expect(
      asOwner.mutation(api.comments.remove, { commentId }),
    ).resolves.toBeNull();
  });

  test("non-author non-owner cannot delete a comment", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownerc2@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownerc2@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const commenterId = await insertUser(t, {
      name: "Commenter",
      email: `commenter3@${DOMAIN}`,
    });
    const asCommenter = asUser(t, commenterId, `commenter3@${DOMAIN}`);

    await asCommenter.mutation(api.memberships.join, { ideaId });

    await asCommenter.mutation(api.comments.create, {
      ideaId,
      content: "Comment",
    });
    const commentId = await getFirstCommentId(t, ideaId);

    const randoId = await insertUser(t, {
      name: "Rando",
      email: `rando@${DOMAIN}`,
    });
    const asRando = asUser(t, randoId, `rando@${DOMAIN}`);

    await expect(
      asRando.mutation(api.comments.remove, { commentId }),
    ).rejects.toThrow("Can only delete your own comments");
  });
});

describe("Membership authorization", () => {
  test("owner cannot leave their own idea", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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

describe("Notification authorization", () => {
  test("user cannot mark another user's notification as read", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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

describe("Ownership transfer authorization", () => {
  test("non-owner cannot initiate ownership transfer", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownert@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownert@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const otherId = await insertUser(t, {
      name: "Other",
      email: `othert@${DOMAIN}`,
    });
    const asOther = asUser(t, otherId, `othert@${DOMAIN}`);

    await expect(
      asOther.mutation(api.ideas.requestOwnershipTransfer, {
        ideaId,
        targetUserId: otherId,
      }),
    ).rejects.toThrow("Only the owner can transfer ownership");
  });

  test("non-recipient cannot accept ownership transfer", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownert2@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownert2@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const recipientId = await insertUser(t, {
      name: "Recipient",
      email: `recipientt@${DOMAIN}`,
    });

    const requestId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("ownershipTransferRequests", {
        ideaId,
        requesterId: ownerId,
        recipientId,
        leaveAfterTransfer: false,
        status: "pending",
      });
    });

    const randoId = await insertUser(t, {
      name: "Rando",
      email: `randot@${DOMAIN}`,
    });
    const asRando = asUser(t, randoId, `randot@${DOMAIN}`);

    await expect(
      asRando.mutation(api.ideas.acceptOwnershipTransfer, { requestId }),
    ).rejects.toThrow("Only the requested approver can accept this transfer");
  });

  test("non-recipient cannot decline ownership transfer", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownert3@${DOMAIN}`,
    });

    const ideaId = await asUser(t, ownerId, `ownert3@${DOMAIN}`).mutation(
      api.ideas.create,
      { ...makeIdeaArgs(categoryId) },
    );

    const recipientId = await insertUser(t, {
      name: "Recipient",
      email: `recipientt2@${DOMAIN}`,
    });

    const requestId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("ownershipTransferRequests", {
        ideaId,
        requesterId: ownerId,
        recipientId,
        leaveAfterTransfer: false,
        status: "pending",
      });
    });

    const randoId = await insertUser(t, {
      name: "Rando",
      email: `randot2@${DOMAIN}`,
    });
    const asRando = asUser(t, randoId, `randot2@${DOMAIN}`);

    await expect(
      asRando.mutation(api.ideas.declineOwnershipTransfer, { requestId }),
    ).rejects.toThrow("Only the requested approver can decline this transfer");
  });

  test("non-requester cannot cancel ownership transfer", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownert4@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownert4@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const requesterId = await insertUser(t, {
      name: "Requester",
      email: `requestert@${DOMAIN}`,
    });

    const requestId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("ownershipTransferRequests", {
        ideaId,
        requesterId,
        recipientId: ownerId,
        leaveAfterTransfer: false,
        status: "pending",
      });
    });

    await expect(
      asOwner.mutation(api.ideas.cancelOwnershipTransfer, { requestId }),
    ).rejects.toThrow("Only the requester can cancel this transfer request");
  });

  test("non-member cannot request ownership", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
    const categoryId = await seedCategory(t);

    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `ownert5@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `ownert5@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
    });

    const nonMemberId = await insertUser(t, {
      name: "NonMember",
      email: `nonmembert@${DOMAIN}`,
    });
    const asNonMember = asUser(t, nonMemberId, `nonmembert@${DOMAIN}`);

    await expect(
      asNonMember.mutation(api.ideas.requestOwnership, { ideaId }),
    ).rejects.toThrow("Only team members can request ownership");
  });
});

describe("Input validation & enum enforcement", () => {
  test("rejects invalid status on idea creation", async () => {
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
    const t = convexTest(schema, modules);
    process.env.ALLOWED_DOMAIN = DOMAIN;
    process.env.ALLOWED_EMAILS = "";
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
