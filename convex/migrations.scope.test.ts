/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  assertUniqueHackathonParticipant,
  backfillInitialHackathonParticipant,
  cleanupInvalidIdeaChild,
  cleanupInvalidRelatedIdea,
  cleanupInvalidScopedRoot,
  cleanupLegacyEventSetting,
  repairIdeaChildHackathonId,
  repairRelatedIdeaHackathonId,
  repairScopedRootHackathonId,
} from "./migrations";
import { initTest, insertUser } from "./testHelpers.test";

async function seedHackathons(
  t: ReturnType<typeof initTest>,
  userId: Id<"users">,
) {
  return await t.run(async (ctx: any) => {
    const now = Date.now();
    const first = (await ctx.db.insert("hackathons", {
      slug: "migration-first",
      title: "Migration First",
      startsAt: now,
      timezone: "UTC",
      status: "active",
      createdBy: userId,
      updatedBy: userId,
      updatedAt: now,
    })) as Id<"hackathons">;
    const second = (await ctx.db.insert("hackathons", {
      slug: "migration-second",
      title: "Migration Second",
      startsAt: now + 1,
      timezone: "UTC",
      status: "upcoming",
      createdBy: userId,
      updatedBy: userId,
      updatedAt: now,
    })) as Id<"hackathons">;
    await ctx.db.insert("platformSettings", {
      key: "main",
      currentHackathonId: first,
      updatedBy: userId,
      updatedAt: now,
    });
    return { first, second };
  });
}

function ideaFields(ownerId: Id<"users">, title: string) {
  return {
    title,
    pitch: "Migration fixture",
    problem: "Legacy data",
    targetAudience: "Maintainers",
    skillsNeeded: [],
    status: "exploring",
    lookingForRoles: [],
    ownerId,
  };
}

describe("hackathon scope migrations", () => {
  test("pins the canonical target across resumable batches", async () => {
    const t = initTest();
    const userId = await insertUser(t);
    const { first, second } = await seedHackathons(t, userId);
    const { firstCategoryId, secondCategoryId } = await t.run(
      async (ctx: any) => ({
        firstCategoryId: await ctx.db.insert("categories", {
          name: "First legacy category",
          slug: "first-legacy-category",
        }),
        secondCategoryId: await ctx.db.insert("categories", {
          name: "Second legacy category",
          slug: "second-legacy-category",
        }),
      }),
    );

    await t.run(async (ctx: any) => {
      await repairScopedRootHackathonId(
        ctx,
        (await ctx.db.get(firstCategoryId))!,
      );
      const setting = await ctx.db
        .query("platformSettings")
        .withIndex("by_key", (q: any) => q.eq("key", "main"))
        .unique();
      await ctx.db.patch(setting!._id, {
        currentHackathonId: second,
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await repairScopedRootHackathonId(
        ctx,
        (await ctx.db.get(secondCategoryId))!,
      );
    });

    const state = await t.run(async (ctx: any) => {
      const setting = await ctx.db
        .query("platformSettings")
        .withIndex("by_key", (q: any) => q.eq("key", "main"))
        .unique();
      return {
        firstCategory: await ctx.db.get(firstCategoryId),
        secondCategory: await ctx.db.get(secondCategoryId),
        setting,
      };
    });
    expect(state.firstCategory?.hackathonId).toBe(first);
    expect(state.secondCategory?.hackathonId).toBe(first);
    expect(state.setting?.currentHackathonId).toBe(second);
    expect(state.setting?.scopeMigrationHackathonId).toBe(first);
  });

  test("child scope follows a valid parent and orphaned children are deleted", async () => {
    const t = initTest();
    const userId = await insertUser(t);
    const { first, second } = await seedHackathons(t, userId);

    const fixture = await t.run(async (ctx: any) => {
      const ideaId = (await ctx.db.insert(
        "ideas",
        ideaFields(userId, "Legacy idea"),
      )) as Id<"ideas">;
      const commentId = (await ctx.db.insert("comments", {
        ideaId,
        userId,
        content: "Wrong scope",
        hackathonId: second,
      })) as Id<"comments">;

      const orphanIdeaId = (await ctx.db.insert("ideas", {
        ...ideaFields(userId, "Deleted idea"),
        hackathonId: first,
      })) as Id<"ideas">;
      const orphanCommentId = (await ctx.db.insert("comments", {
        ideaId: orphanIdeaId,
        userId,
        content: "Orphan",
        hackathonId: second,
      })) as Id<"comments">;
      await ctx.db.delete(orphanIdeaId);
      return { ideaId, commentId, orphanCommentId };
    });

    const firstResult = await t.run(async (ctx: any) => {
      const comment = await ctx.db.get(fixture.commentId);
      return await repairIdeaChildHackathonId(ctx, comment!);
    });
    const secondResult = await t.run(async (ctx: any) => {
      const comment = await ctx.db.get(fixture.commentId);
      return await repairIdeaChildHackathonId(ctx, comment!);
    });
    await expect(
      t.run(async (ctx: any) => {
        const comment = await ctx.db.get(fixture.orphanCommentId);
        return await repairIdeaChildHackathonId(ctx, comment!);
      }),
    ).rejects.toThrow("runInvalidScopeCleanup");

    expect(firstResult).toBe("patched");
    expect(secondResult).toBe("unchanged");
    const blockedState = await t.run(async (ctx: any) => ({
      idea: await ctx.db.get(fixture.ideaId),
      comment: await ctx.db.get(fixture.commentId),
      orphan: await ctx.db.get(fixture.orphanCommentId),
    }));
    expect(blockedState.idea?.hackathonId).toBe(first);
    expect(blockedState.comment?.hackathonId).toBe(first);
    expect(blockedState.orphan).not.toBeNull();

    expect(
      await t.run(async (ctx: any) =>
        cleanupInvalidIdeaChild(
          ctx,
          (await ctx.db.get(fixture.orphanCommentId))!,
        ),
      ),
    ).toBe("deleted");
    expect(
      await t.run((ctx: any) => ctx.db.get(fixture.orphanCommentId)),
    ).toBeNull();
  });

  test("invalid roots and cross-event relations are cleaned idempotently", async () => {
    const t = initTest();
    const userId = await insertUser(t);
    const { first, second } = await seedHackathons(t, userId);

    const fixture = await t.run(async (ctx: any) => {
      const deletedHackathon = await ctx.db.insert("hackathons", {
        slug: "deleted-event",
        title: "Deleted Event",
        startsAt: Date.now(),
        timezone: "UTC",
        status: "archived",
        createdBy: userId,
        updatedBy: userId,
        updatedAt: Date.now(),
      });
      const categoryId = (await ctx.db.insert("categories", {
        hackathonId: deletedHackathon,
        name: "Orphan category",
        slug: "orphan-category",
      })) as Id<"categories">;
      await ctx.db.delete(deletedHackathon);

      const ideaA = (await ctx.db.insert("ideas", {
        ...ideaFields(userId, "Event A"),
        hackathonId: first,
      })) as Id<"ideas">;
      const ideaB = (await ctx.db.insert("ideas", {
        ...ideaFields(userId, "Event B"),
        hackathonId: second,
      })) as Id<"ideas">;
      const ideaA2 = (await ctx.db.insert("ideas", {
        ...ideaFields(userId, "Event A 2"),
        hackathonId: first,
      })) as Id<"ideas">;
      const crossRelationId = (await ctx.db.insert("relatedIdeas", {
        ideaIdA: ideaA,
        ideaIdB: ideaB,
        hackathonId: first,
        markedByUserId: userId,
        relationType: "related",
      })) as Id<"relatedIdeas">;
      const wrongScopeRelationId = (await ctx.db.insert("relatedIdeas", {
        ideaIdA: ideaA,
        ideaIdB: ideaA2,
        hackathonId: second,
        markedByUserId: userId,
        relationType: "related",
      })) as Id<"relatedIdeas">;
      return { categoryId, crossRelationId, wrongScopeRelationId };
    });

    await expect(
      t.run(async (ctx: any) =>
        repairScopedRootHackathonId(
          ctx,
          (await ctx.db.get(fixture.categoryId))!,
        ),
      ),
    ).rejects.toThrow("runInvalidScopeCleanup");
    await expect(
      t.run(async (ctx: any) =>
        repairRelatedIdeaHackathonId(
          ctx,
          (await ctx.db.get(fixture.crossRelationId))!,
        ),
      ),
    ).rejects.toThrow("runInvalidScopeCleanup");
    expect(
      await t.run(async (ctx: any) =>
        repairRelatedIdeaHackathonId(
          ctx,
          (await ctx.db.get(fixture.wrongScopeRelationId))!,
        ),
      ),
    ).toBe("patched");
    expect(
      await t.run(async (ctx: any) =>
        repairRelatedIdeaHackathonId(
          ctx,
          (await ctx.db.get(fixture.wrongScopeRelationId))!,
        ),
      ),
    ).toBe("unchanged");

    const blocked = await t.run(async (ctx: any) => ({
      category: await ctx.db.get(fixture.categoryId),
      crossRelation: await ctx.db.get(fixture.crossRelationId),
      repairedRelation: await ctx.db.get(fixture.wrongScopeRelationId),
    }));
    expect(blocked.category).not.toBeNull();
    expect(blocked.crossRelation).not.toBeNull();
    expect(blocked.repairedRelation?.hackathonId).toBe(first);

    const cleanupResults = await t.run(async (ctx: any) => ({
      category: await cleanupInvalidScopedRoot(
        ctx,
        (await ctx.db.get(fixture.categoryId))!,
      ),
      relation: await cleanupInvalidRelatedIdea(
        ctx,
        (await ctx.db.get(fixture.crossRelationId))!,
      ),
    }));
    expect(cleanupResults).toEqual({
      category: "deleted",
      relation: "deleted",
    });
  });

  test("participant backfill is idempotent and verification stays bounded", async () => {
    const t = initTest();
    const userId = await insertUser(t, {
      roles: ["developer"],
      participationMode: "remote",
    });
    const { first } = await seedHackathons(t, userId);

    const participantIds = await t.run(async (ctx: any) => {
      const user = await ctx.db.get(userId);
      const firstId = await backfillInitialHackathonParticipant(ctx, user!);
      const secondId = await backfillInitialHackathonParticipant(ctx, user!);
      return { firstId, secondId };
    });
    expect(participantIds.firstId).toBe(participantIds.secondId);

    await t.run(async (ctx: any) => {
      const orphanIdea = await ctx.db.insert("ideas", {
        ...ideaFields(userId, "Verification orphan"),
        hackathonId: first,
      });
      await ctx.db.insert("comments", {
        ideaId: orphanIdea,
        userId,
        content: "Orphan sample",
        hackathonId: first,
      });
      await ctx.db.delete(orphanIdea);
      await ctx.db.insert("categories", {
        name: "Legacy category",
        slug: "legacy-category",
      });
      await ctx.db.insert("eventSettings", {
        key: "main",
        title: "Legacy event",
        startsAt: Date.now(),
        timezone: "UTC",
        active: true,
        updatedBy: userId,
        updatedAt: Date.now(),
      });
    });

    const participants = await t.run(async (ctx: any) =>
      ctx.db
        .query("hackathonParticipants")
        .withIndex("by_hackathon_and_user", (q: any) =>
          q.eq("hackathonId", first).eq("userId", userId),
        )
        .collect(),
    );
    expect(participants).toHaveLength(1);

    const report = await t.query(internal.migrations.verifyHackathonScope, {
      sampleLimit: 2,
    });
    expect(report.exhaustive).toBe(true);
    expect(report.runnerCompletionRequired).toBe(true);
    expect(report.readyForNarrowSchema).toBe(false);
    expect(report.unscoped.categories.sampleCount).toBe(1);
    expect(report.legacyEventSettings.sampleCount).toBe(1);
    expect(report.integrityIssueSamples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "comments", reason: "orphan_idea" }),
      ]),
    );
    expect(report.noObservedBlockers).toBe(false);
  });

  test("duplicate participant rows block normal migration and verification", async () => {
    const t = initTest();
    const userId = await insertUser(t);
    const { first } = await seedHackathons(t, userId);
    await t.run(async (ctx: any) => {
      const participant = {
        hackathonId: first,
        userId,
        onboardingComplete: true,
        registeredAt: Date.now(),
        updatedAt: Date.now(),
      };
      await ctx.db.insert("hackathonParticipants", participant);
      await ctx.db.insert("hackathonParticipants", participant);
    });

    await expect(
      t.run(async (ctx: any) => {
        const user = await ctx.db.get(userId);
        return await backfillInitialHackathonParticipant(ctx, user!);
      }),
    ).rejects.toThrow("duplicate rows exist");
    await expect(
      t.run(async (ctx: any) =>
        assertUniqueHackathonParticipant(ctx, first, userId),
      ),
    ).rejects.toThrow("duplicate rows exist");

    const report = await t.query(internal.migrations.verifyHackathonScope, {
      sampleLimit: 10,
    });
    expect(report.integrityIssueSamples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "hackathonParticipants",
          reason: "duplicate_participant",
        }),
      ]),
    );
    expect(report.noObservedBlockers).toBe(false);
    const rows = await t.run(async (ctx: any) =>
      ctx.db
        .query("hackathonParticipants")
        .withIndex("by_hackathon_and_user", (q: any) =>
          q.eq("hackathonId", first).eq("userId", userId),
        )
        .collect(),
    );
    expect(rows).toHaveLength(2);
  });

  test("bounded diagnostics never imply readiness when integrity scans truncate", async () => {
    const t = initTest();
    const userId = await insertUser(t);
    const { first } = await seedHackathons(t, userId);
    await t.run(async (ctx: any) => {
      for (let index = 0; index < 3; index++) {
        await ctx.db.insert("categories", {
          hackathonId: first,
          name: `Category ${index}`,
          slug: `category-${index}`,
        });
      }
    });

    const report = await t.query(internal.migrations.verifyHackathonScope, {
      sampleLimit: 2,
    });
    expect(report.scanTruncatedByTable.categories).toBe(true);
    expect(report.exhaustive).toBe(false);
    expect(report.noObservedBlockers).toBe(false);
    expect(report.runnerCompletionRequired).toBe(true);
    expect(report.readyForNarrowSchema).toBe(false);
  });

  test("archived implicit migration targets block without changing data", async () => {
    const t = initTest();
    const userId = await insertUser(t);
    const categoryId = await t.run(async (ctx: any) => {
      const now = Date.now();
      const archived = await ctx.db.insert("hackathons", {
        slug: "archived-current",
        title: "Archived Current",
        startsAt: now,
        timezone: "UTC",
        status: "archived",
        createdBy: userId,
        updatedBy: userId,
        updatedAt: now,
      });
      await ctx.db.insert("platformSettings", {
        key: "main",
        currentHackathonId: archived,
        updatedBy: userId,
        updatedAt: now,
      });
      return await ctx.db.insert("categories", {
        name: "Unscoped category",
        slug: "unscoped-category",
      });
    });

    await expect(
      t.run(async (ctx: any) =>
        repairScopedRootHackathonId(ctx, (await ctx.db.get(categoryId))!),
      ),
    ).rejects.toThrow("is archived");
    expect(await t.run((ctx: any) => ctx.db.get(categoryId))).not.toBeNull();
  });

  test("an archived legacy-hackathon candidate is never selected implicitly", async () => {
    const t = initTest();
    const userId = await insertUser(t);
    const categoryId = await t.run(async (ctx: any) => {
      const now = Date.now();
      await ctx.db.insert("hackathons", {
        slug: "legacy-hackathon",
        title: "Archived Legacy",
        startsAt: now,
        timezone: "UTC",
        status: "archived",
        createdBy: userId,
        updatedBy: userId,
        updatedAt: now,
      });
      return await ctx.db.insert("categories", {
        name: "Legacy category",
        slug: "legacy-category",
      });
    });

    await expect(
      t.run(async (ctx: any) =>
        repairScopedRootHackathonId(ctx, (await ctx.db.get(categoryId))!),
      ),
    ).rejects.toThrow("is archived");
    expect(await t.run((ctx: any) => ctx.db.get(categoryId))).not.toBeNull();
  });

  test("legacy event cleanup creates canonical settings before deletion", async () => {
    const t = initTest();
    const userId = await insertUser(t);
    const eventSettingId = (await t.run(async (ctx: any) => {
      return await ctx.db.insert("eventSettings", {
        key: "main",
        title: "Legacy canonical event",
        startsAt: Date.now(),
        timezone: "UTC",
        active: true,
        updatedBy: userId,
        updatedAt: Date.now(),
      });
    })) as Id<"eventSettings">;

    expect(
      await t.run(async (ctx: any) =>
        cleanupLegacyEventSetting(ctx, eventSettingId),
      ),
    ).toBe("deleted");
    expect(
      await t.run(async (ctx: any) =>
        cleanupLegacyEventSetting(ctx, eventSettingId),
      ),
    ).toBe("unchanged");

    const state = await t.run(async (ctx: any) => {
      const hackathon = await ctx.db
        .query("hackathons")
        .withIndex("by_slug", (q: any) => q.eq("slug", "legacy-hackathon"))
        .unique();
      const platform = await ctx.db
        .query("platformSettings")
        .withIndex("by_key", (q: any) => q.eq("key", "main"))
        .unique();
      return {
        eventSetting: await ctx.db.get(eventSettingId),
        hackathon,
        platform,
      };
    });
    expect(state.eventSetting).toBeNull();
    expect(state.hackathon?.title).toBe("Legacy canonical event");
    expect(state.platform?.currentHackathonId).toBe(state.hackathon?._id);
  });
});
