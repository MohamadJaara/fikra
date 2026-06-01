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

describe("Idea submission deadline", () => {
  test("only admins can change the idea deadline", async () => {
    const t = initTest();
    const userId = await insertUser(t, {
      email: `deadline-user@${DOMAIN}`,
      isAdmin: false,
    });
    const asRegularUser = asUser(t, userId, `deadline-user@${DOMAIN}`);

    await expect(
      asRegularUser.mutation(api.ideaSubmissions.save, {
        deadlineAt: Date.now() + 1000,
        timezone: "UTC",
        active: true,
      }),
    ).rejects.toThrow("Admin access required");
  });

  test("closed deadline blocks new idea creation with the admin message", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    const adminId = await insertUser(t, {
      email: `deadline-admin@${DOMAIN}`,
      isAdmin: true,
    });
    const userId = await insertUser(t, {
      email: `deadline-creator@${DOMAIN}`,
    });
    const asAdmin = asUser(t, adminId, `deadline-admin@${DOMAIN}`);
    const asCreator = asUser(t, userId, `deadline-creator@${DOMAIN}`);

    await asAdmin.mutation(api.ideaSubmissions.save, {
      deadlineAt: Date.now() - 1000,
      timezone: "UTC",
      message: "Submissions are closed for judging.",
      active: true,
    });

    await expect(
      asCreator.mutation(api.ideas.create, makeIdeaArgs(categoryId)),
    ).rejects.toThrow("Submissions are closed for judging.");
  });

  test("resuming submissions allows idea creation again", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);
    const adminId = await insertUser(t, {
      email: `deadline-resume-admin@${DOMAIN}`,
      isAdmin: true,
    });
    const userId = await insertUser(t, {
      email: `deadline-resume-creator@${DOMAIN}`,
    });
    const asAdmin = asUser(t, adminId, `deadline-resume-admin@${DOMAIN}`);
    const asCreator = asUser(t, userId, `deadline-resume-creator@${DOMAIN}`);

    await asAdmin.mutation(api.ideaSubmissions.save, {
      deadlineAt: Date.now() - 1000,
      timezone: "UTC",
      active: true,
    });
    await asAdmin.mutation(api.ideaSubmissions.clear, {});

    await expect(
      asCreator.mutation(api.ideas.create, makeIdeaArgs(categoryId)),
    ).resolves.toBeDefined();
  });
});
