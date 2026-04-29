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

describe("Ownership transfer authorization", () => {
  test("non-owner cannot initiate ownership transfer", async () => {
    const t = initTest();
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
    const t = initTest();
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
    const t = initTest();
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
    const t = initTest();
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
    const t = initTest();
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
