/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

export const modules = import.meta.glob("./**/*.ts");
export const DOMAIN = "test.com";
export const DEFAULT_TEST_HACKATHON_SLUG = "test-default";

function isAllowedTestUser(user: { email?: string }) {
  return user.email?.toLowerCase().endsWith(`@${DOMAIN}`) === true;
}

async function ensureDefaultParticipant(
  ctx: any,
  hackathonId: Id<"hackathons">,
  user: any,
) {
  if (!isAllowedTestUser(user)) return;
  const existing = await ctx.db
    .query("hackathonParticipants")
    .withIndex("by_hackathon_and_user", (q: any) =>
      q.eq("hackathonId", hackathonId).eq("userId", user._id),
    )
    .unique();
  const now = Date.now();
  const participationMode =
    user.participationMode === "remote" ? "remote" : "onsite";
  if (existing) {
    await ctx.db.patch(existing._id, {
      roles: user.roles ?? [],
      participationMode,
      onboardingComplete: true,
      updatedAt: now,
    });
    return;
  }
  await ctx.db.insert("hackathonParticipants", {
    hackathonId,
    userId: user._id,
    roles: user.roles ?? [],
    participationMode,
    onboardingComplete: true,
    registeredAt: now,
    updatedAt: now,
  });
}

async function ensureDefaultTestHackathon(ctx: any) {
  let hackathon = await ctx.db
    .query("hackathons")
    .withIndex("by_slug", (q: any) => q.eq("slug", DEFAULT_TEST_HACKATHON_SLUG))
    .unique();
  let users = await ctx.db.query("users").collect();
  let creator = users.find(isAllowedTestUser);
  const now = Date.now();

  if (!creator) {
    const creatorId = await ctx.db.insert("users", {
      name: "Default Test Fixture",
      email: `fixture@${DOMAIN}`,
      emailVerificationTime: now,
      onboardingComplete: true,
      participationMode: "onsite",
    });
    creator = await ctx.db.get(creatorId);
    users = creator ? [...users, creator] : users;
  }
  if (!creator) throw new Error("Failed to create the default test user");

  if (!hackathon) {
    const hackathonId = await ctx.db.insert("hackathons", {
      slug: DEFAULT_TEST_HACKATHON_SLUG,
      title: "Default Test Hackathon",
      startsAt: now + 7 * 24 * 60 * 60 * 1000,
      timezone: "UTC",
      status: "upcoming",
      createdBy: creator._id,
      updatedBy: creator._id,
      updatedAt: now,
    });
    hackathon = await ctx.db.get(hackathonId);
  } else if (hackathon.status === "archived") {
    await ctx.db.patch(hackathon._id, {
      status: "upcoming",
      completedAt: undefined,
      completedBy: undefined,
      updatedBy: creator._id,
      updatedAt: now,
    });
    hackathon = await ctx.db.get(hackathon._id);
  }
  if (!hackathon)
    throw new Error("Failed to create the default test hackathon");

  const setting = await ctx.db
    .query("platformSettings")
    .withIndex("by_key", (q: any) => q.eq("key", "main"))
    .unique();
  if (setting) {
    await ctx.db.patch(setting._id, {
      currentHackathonId: hackathon._id,
      updatedBy: creator._id,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("platformSettings", {
      key: "main",
      currentHackathonId: hackathon._id,
      updatedBy: creator._id,
      updatedAt: now,
    });
  }

  for (const user of users) {
    await ensureDefaultParticipant(ctx, hackathon._id, user);
  }
  return hackathon;
}

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
    const userId = await ctx.db.insert("users", {
      name: "Test User",
      email: `user${Date.now()}@${DOMAIN}`,
      emailVerificationTime: Date.now(),
      onboardingComplete: true,
      participationMode: "onsite",
      ...overrides,
    });
    const defaultHackathon = await ctx.db
      .query("hackathons")
      .withIndex("by_slug", (q: any) =>
        q.eq("slug", DEFAULT_TEST_HACKATHON_SLUG),
      )
      .unique();
    const user = await ctx.db.get(userId);
    if (defaultHackathon && user) {
      await ensureDefaultParticipant(ctx, defaultHackathon._id, user);
    }
    return userId;
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
    const hackathon = await ensureDefaultTestHackathon(ctx);
    return await ctx.db.insert("categories", {
      hackathonId: hackathon._id,
      name: "Test Category",
      slug: "test-category",
    });
  })) as Id<"categories">;
}

export async function seedRoles(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx: any) => {
    const hackathon = await ensureDefaultTestHackathon(ctx);
    await ctx.db.insert("roles", {
      hackathonId: hackathon._id,
      name: "Developer",
      slug: "developer",
    });
  });
}

export async function seedResources(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx: any) => {
    const hackathon = await ensureDefaultTestHackathon(ctx);
    await ctx.db.insert("resources", {
      hackathonId: hackathon._id,
      name: "Linux VPS",
      slug: "linux_vps",
    });
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
