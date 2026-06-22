/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { asUser, DOMAIN, initTest, insertUser } from "./testHelpers.test";

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
});
