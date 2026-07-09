/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { asUser, DOMAIN, initTest, insertUser } from "./testHelpers.test";

async function insertHackathon(
  t: ReturnType<typeof initTest>,
  adminId: Id<"users">,
  status: "draft" | "upcoming" | "active" | "completed" = "upcoming",
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("hackathons", {
      slug: `event-${status}-${Date.now()}`,
      title: "Initial event",
      startsAt: Date.now() + 10_000,
      timezone: "UTC",
      status,
      createdBy: adminId,
      updatedBy: adminId,
      updatedAt: Date.now(),
    });
  });
}

describe("Event settings authorization", () => {
  test("only admins can save the event date", async () => {
    const t = initTest();
    const userId = await insertUser(t, {
      email: `event-user@${DOMAIN}`,
      isAdmin: false,
    });
    const asRegularUser = asUser(t, userId, `event-user@${DOMAIN}`);
    const hackathonId = await insertHackathon(t, userId);

    await expect(
      asRegularUser.mutation(api.event.save, {
        hackathonId,
        title: "Demo Day",
        startsAt: Date.now() + 1000,
        endsAt: Date.now() + 2000,
        timezone: "UTC",
        active: true,
      }),
    ).rejects.toThrow("Admin access required");
  });

  test("active event date is visible to authenticated users", async () => {
    const t = initTest();
    const adminId = await insertUser(t, {
      email: `event-admin@${DOMAIN}`,
      isAdmin: true,
    });
    const userId = await insertUser(t, {
      email: `event-viewer@${DOMAIN}`,
    });
    const asAdmin = asUser(t, adminId, `event-admin@${DOMAIN}`);
    const asViewer = asUser(t, userId, `event-viewer@${DOMAIN}`);
    const hackathonId = await insertHackathon(t, adminId);
    const startsAt = Date.now() + 1000;
    const endsAt = startsAt + 8 * 60 * 60 * 1000;

    await asAdmin.mutation(api.event.save, {
      hackathonId,
      title: "Demo Day",
      startsAt,
      endsAt,
      timezone: "UTC",
      location: "Main Hall",
      active: true,
    });

    const event = await asViewer.query(api.event.getCurrent, {});

    expect(event?.title).toBe("Demo Day");
    expect(event?.startsAt).toBe(startsAt);
    expect(event?.endsAt).toBe(endsAt);
    expect(event?.location).toBe("Main Hall");
    expect(event?._id).toBe(hackathonId);

    const legacyRows = await t.run(async (ctx) =>
      ctx.db.query("eventSettings").collect(),
    );
    expect(legacyRows).toHaveLength(0);
  });

  test("event end date must be after the start date", async () => {
    const t = initTest();
    const adminId = await insertUser(t, {
      email: `event-admin-range@${DOMAIN}`,
      isAdmin: true,
    });
    const asAdmin = asUser(t, adminId, `event-admin-range@${DOMAIN}`);
    const hackathonId = await insertHackathon(t, adminId);
    const startsAt = Date.now() + 1000;

    await expect(
      asAdmin.mutation(api.event.save, {
        hackathonId,
        title: "Demo Day",
        startsAt,
        endsAt: startsAt,
        timezone: "UTC",
        active: true,
      }),
    ).rejects.toThrow("Event end date must be after the start date");
  });

  test("inactive event date is hidden from regular users", async () => {
    const t = initTest();
    const adminId = await insertUser(t, {
      email: `event-admin-hidden@${DOMAIN}`,
      isAdmin: true,
    });
    const userId = await insertUser(t, {
      email: `event-viewer-hidden@${DOMAIN}`,
    });
    const asAdmin = asUser(t, adminId, `event-admin-hidden@${DOMAIN}`);
    const asViewer = asUser(t, userId, `event-viewer-hidden@${DOMAIN}`);
    const hackathonId = await insertHackathon(t, adminId);

    await asAdmin.mutation(api.event.save, {
      hackathonId,
      title: "Demo Day",
      startsAt: Date.now() + 1000,
      timezone: "UTC",
      active: false,
    });

    await expect(
      asViewer.query(api.event.getForAdmin, { hackathonId }),
    ).rejects.toThrow("Admin access required");
    expect(await asViewer.query(api.event.getCurrent, {})).toBeNull();
  });

  test("admins can mark the hackathon done and reopen it", async () => {
    const t = initTest();
    const adminId = await insertUser(t, {
      email: `event-admin-done@${DOMAIN}`,
      isAdmin: true,
    });
    const userId = await insertUser(t, {
      email: `event-viewer-done@${DOMAIN}`,
    });
    const asAdmin = asUser(t, adminId, `event-admin-done@${DOMAIN}`);
    const asViewer = asUser(t, userId, `event-viewer-done@${DOMAIN}`);
    const hackathonId = await insertHackathon(t, adminId, "active");

    await asAdmin.mutation(api.event.save, {
      hackathonId,
      title: "Demo Day",
      startsAt: Date.now() + 1000,
      timezone: "UTC",
      active: true,
    });

    await expect(
      asViewer.mutation(api.event.markDone, { hackathonId }),
    ).rejects.toThrow("Admin access required");

    const result = await asAdmin.mutation(api.event.markDone, { hackathonId });
    expect(result.completedAt).toEqual(expect.any(Number));

    const completedEvent = await asViewer.query(api.event.getCurrent, {});
    expect(completedEvent?.completedAt).toBe(result.completedAt);
    expect(completedEvent?.completedBy).toBe(adminId);

    await asAdmin.mutation(api.event.reopen, { hackathonId });

    const reopenedEvent = await asViewer.query(api.event.getCurrent, {});
    expect(reopenedEvent?.completedAt).toBeUndefined();
    expect(reopenedEvent?.completedBy).toBeUndefined();
    expect(reopenedEvent?.status).toBe("upcoming");
  });

  test("event adapter requires a canonical hackathon and never creates legacy settings", async () => {
    const t = initTest();
    const email = `event-admin-empty@${DOMAIN}`;
    const adminId = await insertUser(t, { email, isAdmin: true });
    const asAdmin = asUser(t, adminId, email);

    await expect(
      asAdmin.mutation(api.event.save, {
        title: "Orphan event",
        startsAt: Date.now() + 1000,
        timezone: "UTC",
        active: true,
      }),
    ).rejects.toThrow("Choose or create a hackathon first");

    const legacyRows = await t.run(async (ctx) =>
      ctx.db.query("eventSettings").collect(),
    );
    expect(legacyRows).toHaveLength(0);
  });
});
