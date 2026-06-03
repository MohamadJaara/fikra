/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  asUser,
  DOMAIN,
  initTest,
  insertUser,
  makeIdeaArgs,
  seedCategory,
  seedResources,
  seedRoles,
} from "./testHelpers.test";

describe("Admin dashboard stats", () => {
  test("summarizes rooms, resource blockers, and role pressure", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    await seedRoles(t);
    await seedResources(t);

    const adminId = await insertUser(t, {
      name: "Admin",
      email: `dashboard-admin@${DOMAIN}`,
      isAdmin: true,
      roles: ["developer"],
    });
    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `dashboard-owner@${DOMAIN}`,
    });
    const memberId = await insertUser(t, {
      name: "Developer",
      email: `dashboard-developer@${DOMAIN}`,
      roles: ["developer"],
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("roles", { name: "Designer", slug: "designer" });
      await ctx.db.insert("rooms", { name: "Team Room A", type: "team" });

      const ideaId = (await ctx.db.insert("ideas", {
        title: "Room Ready Idea",
        pitch: "A pitch",
        problem: "A problem",
        targetAudience: "Hackathon participants",
        skillsNeeded: [],
        teamSize: "small",
        status: "forming_team",
        lookingForRoles: ["developer", "designer"],
        ownerId,
        categoryId,
        teamFormationStatus: "formed",
        roomRequestStatus: "requested",
        memberCount: 1,
        interestCount: 2,
      })) as Id<"ideas">;

      await ctx.db.insert("ideaMembers", {
        ideaId,
        userId: memberId,
        memberRoles: ["developer"],
      });
      await ctx.db.insert("resourceRequests", {
        ideaId,
        tag: "linux_vps",
        resolved: false,
      });
    });

    const stats = await asUser(t, adminId, `dashboard-admin@${DOMAIN}`).query(
      api.admin.stats,
      {},
    );

    expect(stats.teamFormation).toMatchObject({ formed: 1, forming: 0 });
    expect(stats.roomOverview.queuedRoomRequests).toBe(1);
    expect(stats.roomOverview.availableTeamRooms).toBe(1);
    expect(stats.unresolvedResources).toBe(1);
    expect(stats.resourceNeeds[0]).toMatchObject({
      slug: "linux_vps",
      name: "Linux VPS",
      count: 1,
    });
    expect(stats.roleGaps[0]).toMatchObject({
      slug: "designer",
      name: "Designer",
      missing: 1,
      gap: 1,
    });
    expect(stats.topIdeasNeedingRooms[0]).toMatchObject({
      title: "Room Ready Idea",
      roomRequestStatus: "requested",
      missingRoles: ["designer"],
      unresolvedResources: 1,
    });
  });

  test("admin shelving notifies owner and owner can unshelve", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const adminId = await insertUser(t, {
      name: "Admin",
      email: `shelve-admin@${DOMAIN}`,
      isAdmin: true,
    });
    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `shelve-owner@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `shelve-owner@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Needs Moderation",
    });

    await asUser(t, adminId, `shelve-admin@${DOMAIN}`).mutation(
      api.admin.updateIdeaStatus,
      {
        ideaId,
        status: "shelved",
      },
    );

    const shelvedIdea = await t.run(async (ctx: any) => {
      return await ctx.db.get(ideaId);
    });
    expect(shelvedIdea.status).toBe("shelved");
    expect(shelvedIdea.adminShelvedBy).toBe(adminId);
    expect(shelvedIdea.adminShelvedAt).toBeTypeOf("number");

    const notifications = await asOwner.query(api.notifications.list, {});
    expect(notifications[0]).toMatchObject({
      type: "idea_shelved_by_admin",
      actorName: "Admin",
      ideaTitle: "Needs Moderation",
    });

    await asOwner.mutation(api.ideas.unshelve, { ideaId });

    const reopenedIdea = await t.run(async (ctx: any) => {
      return await ctx.db.get(ideaId);
    });
    expect(reopenedIdea.status).toBe("exploring");
    expect(reopenedIdea.adminShelvedBy).toBeUndefined();
    expect(reopenedIdea.adminShelvedAt).toBeUndefined();
  });

  test("ideas report is admin-only and includes decision data", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    const adminId = await insertUser(t, {
      name: "Admin",
      email: `report-admin@${DOMAIN}`,
      isAdmin: true,
    });
    const ownerId = await insertUser(t, {
      name: "Owner",
      email: `report-owner@${DOMAIN}`,
    });
    const asOwner = asUser(t, ownerId, `report-owner@${DOMAIN}`);

    const ideaId = await asOwner.mutation(api.ideas.create, {
      ...makeIdeaArgs(categoryId),
      title: "Report Idea",
      status: "building",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.patch(ideaId, {
        teamFormationStatus: "formed",
        roomRequestStatus: "requested",
      });
      await ctx.db.insert("resourceRequests", {
        ideaId,
        tag: "linux_vps",
        resolved: false,
      });
      await ctx.db.insert("rooms", {
        name: "Shared Lab",
        type: "shared",
        assignmentLimit: 3,
      });
    });

    await expect(asOwner.query(api.admin.ideasReport, {})).rejects.toThrow(
      "Admin access required",
    );

    const report = await asUser(t, adminId, `report-admin@${DOMAIN}`).query(
      api.admin.ideasReport,
      {},
    );

    expect(report.summary.totalIdeas).toBe(1);
    expect(report.summary.roomRequests).toBe(1);
    expect(report.summary.resourceBlockedIdeas).toBe(1);
    expect(report.decisionQueues.roomRequests[0]).toMatchObject({
      title: "Report Idea",
      roomRequestStatus: "requested",
      unresolvedResources: 1,
    });
    expect(report.roomUsage[0]).toMatchObject({
      name: "Shared Lab",
      type: "shared",
      assignmentLimit: 3,
    });
  });
});
