/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { asUser, DOMAIN, initTest, insertUser } from "./testHelpers.test";

describe("Event settings authorization", () => {
  test("only admins can save the event date", async () => {
    const t = initTest();
    const userId = await insertUser(t, {
      email: `event-user@${DOMAIN}`,
      isAdmin: false,
    });
    const asRegularUser = asUser(t, userId, `event-user@${DOMAIN}`);

    await expect(
      asRegularUser.mutation(api.event.save, {
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
    const startsAt = Date.now() + 1000;
    const endsAt = startsAt + 8 * 60 * 60 * 1000;

    await asAdmin.mutation(api.event.save, {
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
  });

  test("event end date must be after the start date", async () => {
    const t = initTest();
    const adminId = await insertUser(t, {
      email: `event-admin-range@${DOMAIN}`,
      isAdmin: true,
    });
    const asAdmin = asUser(t, adminId, `event-admin-range@${DOMAIN}`);
    const startsAt = Date.now() + 1000;

    await expect(
      asAdmin.mutation(api.event.save, {
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

    await asAdmin.mutation(api.event.save, {
      title: "Demo Day",
      startsAt: Date.now() + 1000,
      timezone: "UTC",
      active: false,
    });

    await expect(asViewer.query(api.event.getForAdmin, {})).rejects.toThrow(
      "Admin access required",
    );
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

    await asAdmin.mutation(api.event.save, {
      title: "Demo Day",
      startsAt: Date.now() + 1000,
      timezone: "UTC",
      active: true,
    });

    await expect(asViewer.mutation(api.event.markDone, {})).rejects.toThrow(
      "Admin access required",
    );

    const result = await asAdmin.mutation(api.event.markDone, {});
    expect(result.completedAt).toEqual(expect.any(Number));

    const completedEvent = await asViewer.query(api.event.getCurrent, {});
    expect(completedEvent?.completedAt).toBe(result.completedAt);
    expect(completedEvent?.completedBy).toBe(adminId);

    await asAdmin.mutation(api.event.reopen, {});

    const reopenedEvent = await asViewer.query(api.event.getCurrent, {});
    expect(reopenedEvent?.completedAt).toBeUndefined();
    expect(reopenedEvent?.completedBy).toBeUndefined();
  });
});
