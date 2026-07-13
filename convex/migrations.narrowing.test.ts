/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import {
  assertIdeaChildReadyForNarrowing,
  assertIdeaReadyForNarrowing,
  assertParticipantReadyForNarrowing,
  assertPlatformReadyForNarrowing,
} from "./migrations";
import { initTest, insertUser } from "./testHelpers.test";

async function currentHackathonId(
  t: ReturnType<typeof initTest>,
  actorId: Id<"users">,
) {
  return (await t.run(async (ctx: any) => {
    const setting = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q: any) => q.eq("key", "main"))
      .unique();
    if (setting) return setting.currentHackathonId;
    const hackathonId = await ctx.db.insert("hackathons", {
      slug: "narrowing-current",
      title: "Narrowing Current",
      startsAt: Date.now(),
      timezone: "UTC",
      status: "active",
      createdBy: actorId,
      updatedBy: actorId,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("platformSettings", {
      key: "main",
      currentHackathonId: hackathonId,
      updatedBy: actorId,
      updatedAt: Date.now(),
    });
    return hackathonId;
  })) as Id<"hackathons">;
}

describe("narrow hackathon schema", () => {
  test("rejects event-owned records without hackathonId", async () => {
    const t = initTest();
    const userId = await insertUser(t);

    await expect(
      t.run((ctx: any) =>
        ctx.db.insert("ideas", {
          title: "Unscoped idea",
          pitch: "Invalid after narrowing",
          problem: "Missing event scope",
          targetAudience: "Maintainers",
          skillsNeeded: [],
          status: "exploring",
          lookingForRoles: [],
          ownerId: userId,
        }),
      ),
    ).rejects.toThrow("Missing required field `hackathonId`");
  });

  test("verification accepts consistent rows and rejects cross-event children", async () => {
    const t = initTest();
    const userId = await insertUser(t);
    const first = await currentHackathonId(t, userId);
    const second = (await t.run((ctx: any) =>
      ctx.db.insert("hackathons", {
        slug: "narrowing-second",
        title: "Narrowing Second",
        startsAt: Date.now(),
        timezone: "UTC",
        status: "upcoming",
        createdBy: userId,
        updatedBy: userId,
        updatedAt: Date.now(),
      }),
    )) as Id<"hackathons">;

    const { ideaId, commentId } = await t.run(async (ctx: any) => {
      const ideaId = await ctx.db.insert("ideas", {
        hackathonId: first,
        title: "Scoped idea",
        pitch: "Valid scope",
        problem: "Verification",
        targetAudience: "Maintainers",
        skillsNeeded: [],
        status: "exploring",
        lookingForRoles: [],
        ownerId: userId,
      });
      const commentId = await ctx.db.insert("comments", {
        hackathonId: second,
        ideaId,
        userId,
        content: "Wrong event",
      });
      return { ideaId, commentId };
    });

    await expect(
      t.run((ctx: any) => assertPlatformReadyForNarrowing(ctx)),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx: any) =>
        assertIdeaReadyForNarrowing(ctx, (await ctx.db.get(ideaId))!),
      ),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx: any) =>
        assertIdeaChildReadyForNarrowing(
          ctx,
          "comments",
          (await ctx.db.get(commentId))!,
        ),
      ),
    ).rejects.toThrow("does not match parent idea");
  });

  test("verification rejects duplicate participant rows", async () => {
    const t = initTest();
    const userId = await insertUser(t);
    const hackathonId = await currentHackathonId(t, userId);
    const duplicateId = (await t.run(async (ctx: any) => {
      const participant = {
        hackathonId,
        userId,
        onboardingComplete: true,
        registeredAt: Date.now(),
        updatedAt: Date.now(),
      };
      await ctx.db.insert("hackathonParticipants", participant);
      return await ctx.db.insert("hackathonParticipants", participant);
    })) as Id<"hackathonParticipants">;

    await expect(
      t.run(async (ctx: any) =>
        assertParticipantReadyForNarrowing(
          ctx,
          (await ctx.db.get(duplicateId))!,
        ),
      ),
    ).rejects.toThrow("duplicate rows exist");
  });
});
