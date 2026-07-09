/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { asUser, DOMAIN, initTest, insertUser } from "./testHelpers.test";

async function insertHackathon(
  t: ReturnType<typeof initTest>,
  createdBy: Id<"users">,
  values: {
    slug: string;
    status: "draft" | "upcoming" | "active" | "completed" | "archived";
    startsAt: number;
  },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("hackathons", {
      ...values,
      title: values.slug,
      timezone: "UTC",
      createdBy,
      updatedBy: createdBy,
      updatedAt: values.startsAt,
    });
  });
}

describe("Hackathon admin management", () => {
  test("admin can rename a completed hackathon", async () => {
    const t = initTest();
    const adminEmail = `hackathon-admin@${DOMAIN}`;
    const adminId = await insertUser(t, {
      name: "Admin",
      email: adminEmail,
      isAdmin: true,
    });
    const asAdmin = asUser(t, adminId, adminEmail);
    const startsAt = Date.UTC(2026, 0, 10, 9);
    const endsAt = Date.UTC(2026, 0, 11, 17);

    const hackathonId = await asAdmin.mutation(api.hackathons.create, {
      title: "Original Hackathon",
      slug: "original-hackathon",
      startsAt,
      endsAt,
      timezone: "UTC",
      location: "HQ",
      note: "Initial note",
      status: "upcoming",
    });

    await asAdmin.mutation(api.hackathons.complete, { hackathonId });
    await asAdmin.mutation(api.hackathons.update, {
      hackathonId,
      title: "Renamed Hackathon",
      slug: "renamed-hackathon",
      startsAt,
      endsAt,
      timezone: "UTC",
      location: "HQ East",
      note: "Updated note",
      status: "completed",
    });

    const renamed = await asAdmin.query(api.hackathons.getBySlug, {
      slug: "renamed-hackathon",
    });
    const oldSlug = await asAdmin.query(api.hackathons.getBySlug, {
      slug: "original-hackathon",
    });

    expect(renamed).toMatchObject({
      _id: hackathonId,
      title: "Renamed Hackathon",
      slug: "renamed-hackathon",
      status: "completed",
      location: "HQ East",
      note: "Updated note",
      completedBy: adminId,
    });
    expect(renamed?.completedAt).toEqual(expect.any(Number));
    expect(oldSlug).toBeNull();
  });

  test("current hackathon never falls back to an archived event", async () => {
    const t = initTest();
    const email = `current-viewer@${DOMAIN}`;
    const userId = await insertUser(t, { email });
    const viewer = asUser(t, userId, email);
    const archivedId = await insertHackathon(t, userId, {
      slug: "archived",
      status: "archived",
      startsAt: 300,
    });
    const upcomingId = await insertHackathon(t, userId, {
      slug: "upcoming",
      status: "upcoming",
      startsAt: 200,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("platformSettings", {
        key: "main",
        currentHackathonId: archivedId,
        updatedAt: 300,
      });
    });

    const current = await viewer.query(api.hackathons.getCurrent, {});
    expect(current?._id).toBe(upcomingId);
  });

  test("current hackathon is null when every event is archived", async () => {
    const t = initTest();
    const email = `archived-only-viewer@${DOMAIN}`;
    const userId = await insertUser(t, { email });
    const viewer = asUser(t, userId, email);
    await insertHackathon(t, userId, {
      slug: "archived-only",
      status: "archived",
      startsAt: 100,
    });

    await expect(
      viewer.query(api.hackathons.getCurrent, {}),
    ).resolves.toBeNull();
  });

  test("active hackathon is preferred over newer upcoming events", async () => {
    const t = initTest();
    const email = `active-viewer@${DOMAIN}`;
    const userId = await insertUser(t, { email });
    const viewer = asUser(t, userId, email);
    const activeId = await insertHackathon(t, userId, {
      slug: "active",
      status: "active",
      startsAt: 100,
    });
    await insertHackathon(t, userId, {
      slug: "newer-upcoming",
      status: "upcoming",
      startsAt: 200,
    });

    const current = await viewer.query(api.hackathons.getCurrent, {});
    expect(current?._id).toBe(activeId);
  });
});
