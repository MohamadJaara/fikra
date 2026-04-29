/// <reference types="vite/client" />
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import {
  initTest,
  insertUser,
  asUser,
  makeIdeaArgs,
  seedCategory,
} from "./testHelpers.test";

describe("Authentication & email domain gate", () => {
  test("unauthenticated user cannot create an idea", async () => {
    const t = initTest();
    const categoryId = await seedCategory(t);

    await expect(
      t.mutation(api.ideas.create, { ...makeIdeaArgs(categoryId) }),
    ).rejects.toThrow("Not authenticated");
  });

  test("unauthenticated query returns empty list", async () => {
    const t = initTest();
    const result = await t.query(api.ideas.list, {
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(result.page).toEqual([]);
  });

  test("user with disallowed email is rejected", async () => {
    const t = initTest();
    const userId = await insertUser(t, { email: "hacker@evil.com" });
    const asHacker = asUser(t, userId, "hacker@evil.com");

    await expect(
      asHacker.mutation(api.ideas.create, {
        ...makeIdeaArgs(await seedCategory(t)),
      }),
    ).rejects.toThrow("Access denied");
  });
});
