/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import type { FunctionReturnType } from "convex/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  asUser,
  DOMAIN,
  initTest,
  insertUser,
  seedCategory,
} from "./testHelpers.test";

type TestInstance = ReturnType<typeof initTest>;
type IdeaListResult = FunctionReturnType<typeof api.ideas.list>;

async function seedIdeaRows(
  t: TestInstance,
  {
    categoryId,
    ownerId,
    count,
    roleForIndex,
    role = "designer",
  }: {
    categoryId: Id<"categories">;
    ownerId: Id<"users">;
    count: number;
    roleForIndex?: number;
    role?: string;
  },
) {
  return await t.run(async (ctx: any) => {
    const category = await ctx.db.get(categoryId);
    if (!category?.hackathonId) throw new Error("Test hackathon is missing");

    const ids: Id<"ideas">[] = [];
    for (let index = 0; index < count; index++) {
      ids.push(
        await ctx.db.insert("ideas", {
          hackathonId: category.hackathonId,
          title: `Pagination idea ${index}`,
          pitch: "Pagination regression fixture",
          problem: "Filtered rows must not terminate pagination early",
          targetAudience: "Maintainers",
          skillsNeeded: [],
          teamSize: "small",
          status: "exploring",
          lookingForRoles: [index === roleForIndex ? "developer" : role],
          ownerId,
          categoryId,
          memberCount: 0,
          interestCount: count - index,
          reactionCounts: {},
          reactionTotal: 0,
          filledRoles: [],
          resourceRequestCount: 0,
          hasUnresolvedResources: false,
          needsTeammates: true,
          resourceRequestSummary: [],
          trendingScore: 0,
        }),
      );
    }
    return ids;
  });
}

async function setupOwner() {
  const t = initTest();
  const categoryId = await seedCategory(t);
  const email = `pagination-owner@${DOMAIN}`;
  const ownerId = await insertUser(t, { name: "Pagination Owner", email });
  return { t, categoryId, ownerId, client: asUser(t, ownerId, email) };
}

describe("idea list cursor pagination", () => {
  test("default active browsing continues beyond the former 1000-row cap", async () => {
    const fixture = await setupOwner();
    const seededIds = await seedIdeaRows(fixture.t, {
      categoryId: fixture.categoryId,
      ownerId: fixture.ownerId,
      count: 1005,
    });

    const listedIds: Id<"ideas">[] = [];
    let cursor: string | null = null;
    let isDone = false;
    let pageCount = 0;
    while (!isDone && pageCount < 20) {
      const result: IdeaListResult = await fixture.client.query(
        api.ideas.list,
        {
          paginationOpts: { cursor, numItems: 100 },
        },
      );
      listedIds.push(...result.page.map((idea) => idea._id));
      cursor = result.continueCursor;
      isDone = result.isDone;
      pageCount += 1;
    }

    expect(isDone).toBe(true);
    expect(new Set(listedIds).size).toBe(seededIds.length);
    expect(new Set(listedIds)).toEqual(new Set(seededIds));
  });

  test("fills a filtered page by scanning past nonmatching indexed rows", async () => {
    const fixture = await setupOwner();
    const ids = await seedIdeaRows(fixture.t, {
      categoryId: fixture.categoryId,
      ownerId: fixture.ownerId,
      count: 70,
      roleForIndex: 69,
    });

    const result = await fixture.client.query(api.ideas.list, {
      paginationOpts: { cursor: null, numItems: 10 },
      filters: { needsTeammates: true, roles: ["developer"] },
    });

    expect(result.page.map((idea) => idea._id)).toEqual([ids[69]]);
    expect(result.isDone).toBe(true);
  });

  test("keeps pagination open when the bounded scan has not exhausted its source", async () => {
    const fixture = await setupOwner();
    const ids = await seedIdeaRows(fixture.t, {
      categoryId: fixture.categoryId,
      ownerId: fixture.ownerId,
      count: 300,
      roleForIndex: 299,
    });

    const first = await fixture.client.query(api.ideas.list, {
      paginationOpts: { cursor: null, numItems: 10 },
      filters: { roles: ["developer"] },
    });
    expect(first.page).toEqual([]);
    expect(first.isDone).toBe(false);

    const second = await fixture.client.query(api.ideas.list, {
      paginationOpts: { cursor: first.continueCursor, numItems: 10 },
      filters: { roles: ["developer"] },
    });
    expect(second.page.map((idea) => idea._id)).toEqual([ids[299]]);
    expect(second.isDone).toBe(true);
  });

  test("rejects cross-event documents injected through a forged buffered cursor", async () => {
    const fixture = await setupOwner();
    const otherIdeaId = await fixture.t.run(async (ctx: any) => {
      const now = Date.now();
      const otherHackathonId = await ctx.db.insert("hackathons", {
        slug: "pagination-other-event",
        title: "Pagination Other Event",
        startsAt: now,
        timezone: "UTC",
        status: "upcoming",
        createdBy: fixture.ownerId,
        updatedBy: fixture.ownerId,
        updatedAt: now,
      });
      return await ctx.db.insert("ideas", {
        hackathonId: otherHackathonId,
        title: "Injected idea",
        pitch: "Must remain outside the current event",
        problem: "A client-controlled cursor contains an arbitrary ID",
        targetAudience: "Maintainers",
        skillsNeeded: [],
        teamSize: "small",
        status: "exploring",
        lookingForRoles: [],
        ownerId: fixture.ownerId,
        memberCount: 0,
        interestCount: 0,
        reactionCounts: {},
        reactionTotal: 0,
        filledRoles: [],
        resourceRequestCount: 0,
        hasUnresolvedResources: false,
        needsTeammates: false,
        resourceRequestSummary: [],
        trendingScore: 0,
      });
    });
    const source = {
      cursor: null,
      exhausted: true,
      bufferedIds: [otherIdeaId],
    };

    const result = await fixture.client.query(api.ideas.list, {
      paginationOpts: {
        cursor: JSON.stringify({
          version: 1,
          scoped: source,
          legacy: { ...source, bufferedIds: [] },
        }),
        numItems: 10,
      },
    });

    expect(result.page).toEqual([]);
    expect(result.isDone).toBe(true);
  });
});
