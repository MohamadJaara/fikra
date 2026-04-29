/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

export const modules = import.meta.glob("./**/*.ts");
export const DOMAIN = "test.com";

export function initTest() {
  const t = convexTest(schema, modules);
  process.env.ALLOWED_DOMAIN = DOMAIN;
  process.env.ALLOWED_EMAILS = "";
  return t;
}

export async function insertUser(
  t: ReturnType<typeof convexTest>,
  overrides: Record<string, unknown> = {},
) {
  const id = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: `user${Date.now()}@${DOMAIN}`,
      emailVerificationTime: Date.now(),
      onboardingComplete: true,
      participationMode: "onsite",
      ...overrides,
    });
  });
  return id as Id<"users">;
}

export function asUser(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  email: string,
) {
  return t.withIdentity({
    subject: `${userId}|session`,
    issuer: "https://convex.test",
    email,
  });
}

export function makeIdeaArgs(categoryId: Id<"categories">) {
  return {
    title: "Test Idea",
    pitch: "A test pitch",
    problem: "A test problem",
    targetAudience: "Everyone",
    skillsNeeded: [],
    teamSize: "small" as const,
    status: "exploring",
    lookingForRoles: [],
    categoryId,
  };
}

export async function seedCategory(t: ReturnType<typeof convexTest>) {
  return (await t.run(async (ctx: any) => {
    return await ctx.db.insert("categories", {
      name: "Test Category",
      slug: "test-category",
    });
  })) as Id<"categories">;
}

export async function seedRoles(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("roles", { name: "Developer", slug: "developer" });
  });
}

export async function seedResources(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("resources", { name: "Linux VPS", slug: "linux_vps" });
  });
}

export async function getCommentId(
  t: ReturnType<typeof convexTest>,
  ideaId: Id<"ideas">,
) {
  return (await t.run(async (ctx: any) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_idea", (q: any) => q.eq("ideaId", ideaId))
      .collect();
    return comments[0]._id;
  })) as Id<"comments">;
}
