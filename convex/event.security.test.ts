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

    await asAdmin.mutation(api.event.save, {
      title: "Demo Day",
      startsAt,
      timezone: "UTC",
      location: "Main Hall",
      active: true,
    });

    const event = await asViewer.query(api.event.getCurrent, {});

    expect(event?.title).toBe("Demo Day");
    expect(event?.startsAt).toBe(startsAt);
    expect(event?.location).toBe("Main Hall");
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
});
