/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import {
  asUser,
  DOMAIN,
  initTest,
  insertUser,
  makeIdeaArgs,
  seedCategory,
} from "./testHelpers.test";

const DAY = 24 * 60 * 60 * 1000;

function todayAtUtc(hour: number, minute = 0) {
  const now = new Date();
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour,
    minute,
  );
}

describe("Idea submission window", () => {
  test("allows idea creation before the hackathon start day", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    const adminId = await insertUser(t, {
      email: `window-admin@${DOMAIN}`,
      isAdmin: true,
    });
    const userId = await insertUser(t, {
      email: `window-creator@${DOMAIN}`,
    });
    const asAdmin = asUser(t, adminId, `window-admin@${DOMAIN}`);
    const asCreator = asUser(t, userId, `window-creator@${DOMAIN}`);

    const hackathonId = await asAdmin.mutation(api.hackathons.create, {
      title: "Future Hackathon",
      slug: "future-hackathon",
      startsAt: Date.now() + 2 * DAY,
      timezone: "UTC",
      status: "upcoming",
    });

    await expect(
      asCreator.mutation(api.ideas.create, {
        ...makeIdeaArgs(categoryId),
        hackathonId,
      }),
    ).resolves.toBeDefined();
  });

  test("blocks idea creation on the hackathon first day", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    const adminId = await insertUser(t, {
      email: `start-day-admin@${DOMAIN}`,
      isAdmin: true,
    });
    const userId = await insertUser(t, {
      email: `start-day-creator@${DOMAIN}`,
    });
    const asAdmin = asUser(t, adminId, `start-day-admin@${DOMAIN}`);
    const asCreator = asUser(t, userId, `start-day-creator@${DOMAIN}`);
    const startsAt = todayAtUtc(23, 59);

    const hackathonId = await asAdmin.mutation(api.hackathons.create, {
      title: "Today Hackathon",
      slug: "today-hackathon",
      startsAt,
      timezone: "UTC",
      status: "upcoming",
    });

    const window = await asCreator.query(api.ideaSubmissions.getCurrent, {
      hackathonId,
    });

    expect(window).toMatchObject({
      isOpen: false,
      reason: "started",
      startsAt,
      timezone: "UTC",
    });
    await expect(
      asCreator.mutation(api.ideas.create, {
        ...makeIdeaArgs(categoryId),
        hackathonId,
      }),
    ).rejects.toThrow("The first day of Today Hackathon started");
  });

  test("blocks idea creation when the hackathon is marked done", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    const adminId = await insertUser(t, {
      email: `done-admin@${DOMAIN}`,
      isAdmin: true,
    });
    const userId = await insertUser(t, {
      email: `done-creator@${DOMAIN}`,
    });
    const asAdmin = asUser(t, adminId, `done-admin@${DOMAIN}`);
    const asCreator = asUser(t, userId, `done-creator@${DOMAIN}`);

    const hackathonId = await asAdmin.mutation(api.hackathons.create, {
      title: "Done Hackathon",
      slug: "done-hackathon",
      startsAt: Date.now() + 2 * DAY,
      timezone: "UTC",
      status: "upcoming",
    });

    await asAdmin.mutation(api.hackathons.complete, { hackathonId });

    const window = await asCreator.query(api.ideaSubmissions.getCurrent, {
      hackathonId,
    });

    expect(window).toMatchObject({
      isOpen: false,
      reason: "completed",
    });
    await expect(
      asCreator.mutation(api.ideas.create, {
        ...makeIdeaArgs(categoryId),
        hackathonId,
      }),
    ).rejects.toThrow("Done Hackathon is marked done");
  });
});
