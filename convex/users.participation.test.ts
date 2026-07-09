/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { asUser, initTest, insertUser } from "./testHelpers.test";

async function insertHackathon(
  t: ReturnType<typeof initTest>,
  creatorId: Id<"users">,
  slug: string,
  status: "upcoming" | "completed" | "archived" = "upcoming",
) {
  return (await t.run(async (ctx: any) => {
    const now = Date.now();
    return await ctx.db.insert("hackathons", {
      slug,
      title: slug,
      startsAt: now + 60_000,
      timezone: "UTC",
      status,
      createdBy: creatorId,
      updatedBy: creatorId,
      updatedAt: now,
    });
  })) as Id<"hackathons">;
}

async function insertRole(
  t: ReturnType<typeof initTest>,
  hackathonId: Id<"hackathons">,
  slug: string,
) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("roles", {
      hackathonId,
      name: slug,
      slug,
    });
  });
}

describe("event-scoped participant profile contract", () => {
  test("participant reads expose only the current-event legacy fallback", async () => {
    const t = initTest();
    const email = "participant-fallback@test.com";
    const userId = await insertUser(t, {
      email,
      roles: ["legacy-role"],
      participationMode: "remote",
    });
    const hackathonId = await insertHackathon(t, userId, "fallback-event");
    const client = asUser(t, userId, email);

    expect(
      await client.query(api.users.getMyParticipation, { hackathonId }),
    ).toMatchObject({
      hackathonId,
      roles: ["legacy-role"],
      participationMode: "remote",
      onboardingComplete: true,
      legacyFallback: true,
    });

    const otherHackathonId = await insertHackathon(
      t,
      userId,
      "other-current-event",
    );
    await t.run(async (ctx: any) => {
      await ctx.db.insert("platformSettings", {
        key: "main",
        currentHackathonId: otherHackathonId,
        updatedAt: Date.now(),
      });
    });
    expect(
      await client.query(api.users.getMyParticipation, { hackathonId }),
    ).toBeNull();

    const participantId = (await t.run(async (ctx: any) => {
      return await ctx.db.insert("hackathonParticipants", {
        hackathonId,
        userId,
        onboardingComplete: true,
        availabilityNote: "Evenings only",
        registeredAt: Date.now(),
        updatedAt: Date.now(),
      });
    })) as Id<"hackathonParticipants">;

    expect(
      await client.query(api.users.getMyParticipation, { hackathonId }),
    ).toMatchObject({
      _id: participantId,
      hackathonId,
      roles: ["legacy-role"],
      participationMode: "remote",
      onboardingComplete: true,
      availabilityNote: "Evenings only",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.patch(participantId, {
        roles: [],
        participationMode: "onsite",
      });
    });

    expect(
      await client.query(api.users.getMyParticipation, { hackathonId }),
    ).toMatchObject({
      roles: [],
      participationMode: "onsite",
    });
  });

  test("onboarding and profile updates remain isolated between events", async () => {
    const t = initTest();
    const email = "participant-isolation@test.com";
    const userId = await insertUser(t, {
      email,
      onboardingComplete: false,
      roles: ["legacy-role"],
      participationMode: "remote",
    });
    const hackathonA = await insertHackathon(t, userId, "event-a");
    const hackathonB = await insertHackathon(t, userId, "event-b");
    await insertRole(t, hackathonA, "role-a");
    await insertRole(t, hackathonA, "role-a-updated");
    await insertRole(t, hackathonB, "role-b");
    const client = asUser(t, userId, email);

    await client.mutation(api.users.completeOnboarding, {
      hackathonId: hackathonA,
      firstName: "Alpha",
      lastName: "User",
      roles: ["role-a"],
      participationMode: "onsite",
    });
    await client.mutation(api.users.completeOnboarding, {
      hackathonId: hackathonB,
      firstName: "Beta",
      lastName: "User",
      roles: ["role-b"],
      participationMode: "remote",
    });
    await client.mutation(api.users.updateProfile, {
      hackathonId: hackathonA,
      firstName: "Scoped",
      lastName: "User",
      roles: ["role-a-updated"],
      participationMode: "remote",
    });
    await client.mutation(api.users.setParticipationMode, {
      hackathonId: hackathonA,
      mode: "onsite",
    });

    const [participationA, participationB, globalUser] = await Promise.all([
      client.query(api.users.getMyParticipation, { hackathonId: hackathonA }),
      client.query(api.users.getMyParticipation, { hackathonId: hackathonB }),
      t.run(async (ctx: any) => await ctx.db.get(userId)),
    ]);

    expect(participationA).toMatchObject({
      roles: ["role-a-updated"],
      participationMode: "onsite",
      onboardingComplete: true,
    });
    expect(participationB).toMatchObject({
      roles: ["role-b"],
      participationMode: "remote",
      onboardingComplete: true,
    });
    expect(globalUser).toMatchObject({
      firstName: "Scoped",
      lastName: "User",
      name: "Scoped User",
      onboardingComplete: true,
      roles: ["legacy-role"],
      participationMode: "remote",
    });
  });

  test("event-scoped mutations reject missing, absent, and incomplete participation", async () => {
    const t = initTest();
    const email = "participant-required@test.com";
    const userId = await insertUser(t, { email });
    const hackathonId = await insertHackathon(t, userId, "required-event");
    await insertRole(t, hackathonId, "developer");
    const client = asUser(t, userId, email);

    await expect(
      client.mutation(
        api.users.completeOnboarding as any,
        {
          firstName: "Missing",
          lastName: "Event",
          roles: ["developer"],
        } as any,
      ),
    ).rejects.toThrow(/hackathonId/);
    await expect(
      client.mutation(
        api.users.updateProfile as any,
        {
          firstName: "Missing",
          lastName: "Event",
          roles: ["developer"],
        } as any,
      ),
    ).rejects.toThrow(/hackathonId/);
    await expect(
      client.mutation(
        api.users.setParticipationMode as any,
        {
          mode: "onsite",
        } as any,
      ),
    ).rejects.toThrow(/hackathonId/);

    await expect(
      client.mutation(api.users.updateProfile, {
        hackathonId,
        firstName: "No",
        lastName: "Participant",
        roles: ["developer"],
      }),
    ).rejects.toThrow("Complete your hackathon profile before continuing");
    await expect(
      client.mutation(api.users.setParticipationMode, {
        hackathonId,
        mode: "onsite",
      }),
    ).rejects.toThrow("Complete your hackathon profile before continuing");

    await t.run(async (ctx: any) => {
      await ctx.db.insert("hackathonParticipants", {
        hackathonId,
        userId,
        onboardingComplete: false,
        availabilityNote: "Preserve me",
        registeredAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      client.mutation(api.users.updateProfile, {
        hackathonId,
        firstName: "Incomplete",
        lastName: "Participant",
        roles: ["developer"],
      }),
    ).rejects.toThrow("Complete your hackathon profile before continuing");
    await expect(
      client.mutation(api.users.setParticipationMode, {
        hackathonId,
        mode: "onsite",
      }),
    ).rejects.toThrow("Complete your hackathon profile before continuing");

    await client.mutation(api.users.completeOnboarding, {
      hackathonId,
      firstName: "Now",
      lastName: "Complete",
      roles: ["developer"],
      participationMode: "remote",
    });
    expect(
      await client.query(api.users.getMyParticipation, { hackathonId }),
    ).toMatchObject({
      roles: ["developer"],
      participationMode: "remote",
      onboardingComplete: true,
      availabilityNote: "Preserve me",
    });
  });

  test("participant profile mutations cannot bypass a completed event", async () => {
    const t = initTest();
    const email = "participant-locked@test.com";
    const userId = await insertUser(t, { email, isAdmin: true });
    const hackathonId = await insertHackathon(
      t,
      userId,
      "locked-event",
      "completed",
    );
    const client = asUser(t, userId, email);

    await expect(
      client.mutation(api.users.completeOnboarding, {
        hackathonId,
        firstName: "Locked",
        lastName: "Admin",
        roles: [],
      }),
    ).rejects.toThrow("This hackathon is read-only");
  });
});
