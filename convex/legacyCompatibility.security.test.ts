/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { asUser, DOMAIN, initTest } from "./testHelpers.test";

async function seedLegacyFixture() {
  const t = initTest();
  const email = `legacy-owner@${DOMAIN}`;
  const fixture = await t.run(async (ctx: any) => {
    const now = Date.now();
    const ownerId = (await ctx.db.insert("users", {
      email,
      name: "Legacy Owner",
      onboardingComplete: true,
      roles: ["developer"],
      participationMode: "onsite",
    })) as Id<"users">;
    const memberId = (await ctx.db.insert("users", {
      email: `legacy-member@${DOMAIN}`,
      name: "Legacy Member",
      onboardingComplete: true,
    })) as Id<"users">;
    const currentId = (await ctx.db.insert("hackathons", {
      slug: "legacy-current",
      title: "Legacy Current",
      startsAt: now + 100_000,
      timezone: "UTC",
      status: "active",
      createdBy: ownerId,
      updatedBy: ownerId,
      updatedAt: now,
    })) as Id<"hackathons">;
    const otherId = (await ctx.db.insert("hackathons", {
      slug: "legacy-other",
      title: "Legacy Other",
      startsAt: now + 200_000,
      timezone: "UTC",
      status: "upcoming",
      createdBy: ownerId,
      updatedBy: ownerId,
      updatedAt: now,
    })) as Id<"hackathons">;
    await ctx.db.insert("platformSettings", {
      key: "main",
      currentHackathonId: currentId,
      updatedBy: ownerId,
      updatedAt: now,
    });
    await ctx.db.insert("roles", { name: "Developer", slug: "developer" });
    const ideaId = (await ctx.db.insert("ideas", {
      title: "Legacy unscoped idea",
      pitch: "Compatibility",
      problem: "Legacy data",
      targetAudience: "Everyone",
      skillsNeeded: [],
      status: "exploring",
      lookingForRoles: ["developer"],
      ownerId,
    })) as Id<"ideas">;
    const membershipId = (await ctx.db.insert("ideaMembers", {
      ideaId,
      userId: memberId,
    })) as Id<"ideaMembers">;
    return { ownerId, memberId, currentId, otherId, ideaId, membershipId };
  });
  return { t, email, ...fixture };
}

describe("temporary legacy current-event compatibility", () => {
  test("current-event reads and mutations lazily scope legacy idea children", async () => {
    const fixture = await seedLegacyFixture();
    const client = asUser(fixture.t, fixture.ownerId, fixture.email);

    const listed = await client.query(api.ideas.list, {
      hackathonId: fixture.currentId,
      paginationOpts: { cursor: null, numItems: 10 },
      sortBy: "newest",
    });
    expect(listed.page.map((idea) => idea._id)).toContain(fixture.ideaId);

    await client.mutation(api.memberships.updateMemberRoles, {
      ideaId: fixture.ideaId,
      targetUserId: fixture.memberId,
      memberRoles: ["developer"],
    });

    const scoped = await fixture.t.run(async (ctx: any) => ({
      idea: await ctx.db.get(fixture.ideaId),
      membership: await ctx.db.get(fixture.membershipId),
    }));
    expect(scoped.idea?.hackathonId).toBe(fixture.currentId);
    expect(scoped.membership?.hackathonId).toBe(fixture.currentId);
  });

  test("legacy scope cannot be claimed by a non-current explicit event", async () => {
    const fixture = await seedLegacyFixture();
    await fixture.t.run(async (ctx: any) => {
      await ctx.db.insert("hackathonParticipants", {
        hackathonId: fixture.otherId,
        userId: fixture.ownerId,
        roles: [],
        onboardingComplete: true,
        registeredAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    const client = asUser(fixture.t, fixture.ownerId, fixture.email);

    await expect(
      client.query(api.ideas.get, {
        ideaId: fixture.ideaId,
        hackathonId: fixture.otherId,
      }),
    ).rejects.toThrow("Idea does not belong to this hackathon");
    const listed = await client.query(api.ideas.list, {
      hackathonId: fixture.otherId,
      paginationOpts: { cursor: null, numItems: 10 },
      sortBy: "newest",
    });
    expect(listed.page).toHaveLength(0);
  });

  test("populated mismatches fail closed and participant roles are authoritative", async () => {
    const fixture = await seedLegacyFixture();
    const candidateId = (await fixture.t.run(async (ctx: any) => {
      await ctx.db.patch(fixture.ideaId, { hackathonId: fixture.currentId });
      await ctx.db.patch(fixture.membershipId, {
        hackathonId: fixture.otherId,
      });
      await ctx.db.insert("hackathonParticipants", {
        hackathonId: fixture.currentId,
        userId: fixture.ownerId,
        roles: [],
        onboardingComplete: true,
        registeredAt: Date.now(),
        updatedAt: Date.now(),
      });
      return await ctx.db.insert("ideas", {
        hackathonId: fixture.currentId,
        title: "Needs developer",
        pitch: "Participant roles must win",
        problem: "Role leakage",
        targetAudience: "Everyone",
        skillsNeeded: [],
        status: "exploring",
        lookingForRoles: ["developer"],
        ownerId: fixture.memberId,
      });
    })) as Id<"ideas">;
    const client = asUser(fixture.t, fixture.ownerId, fixture.email);

    await expect(
      client.mutation(api.memberships.updateMemberRoles, {
        ideaId: fixture.ideaId,
        targetUserId: fixture.memberId,
        memberRoles: ["developer"],
      }),
    ).rejects.toThrow("Membership does not belong to this hackathon");

    const feed = await client.query(api.discover.getDiscoverFeed, {
      hackathonId: fixture.currentId,
    });
    expect(feed.find((idea) => idea._id === candidateId)?.roleMatchCount).toBe(
      0,
    );
  });
});
