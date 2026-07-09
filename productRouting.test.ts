import { describe, expect, it } from "vitest";
import {
  bypassesParticipantOnboarding,
  productRedirectForParticipation,
} from "./lib/productRouting";

const current = { slug: "current" };
const historical = { slug: "history" };

describe("participant-aware product routing", () => {
  it("sends current and scoped event routes to their own onboarding pages", () => {
    expect(
      productRedirectForParticipation({
        pathname: "/product/discover",
        hackathon: current,
        participation: null,
        votingActive: false,
        isAdmin: false,
      }),
    ).toBe("/product/onboarding");
    expect(
      productRedirectForParticipation({
        pathname: "/product/h/history/ideas",
        hackathon: historical,
        participation: { onboardingComplete: false },
        votingActive: false,
        isAdmin: false,
      }),
    ).toBe("/product/h/history/onboarding");
  });

  it("allows onboarding and returns completed participants to the event base", () => {
    expect(
      productRedirectForParticipation({
        pathname: "/product/h/history/onboarding",
        hackathon: historical,
        participation: null,
        votingActive: false,
        isAdmin: false,
      }),
    ).toBeNull();
    expect(
      productRedirectForParticipation({
        pathname: "/product/h/history/onboarding",
        hackathon: historical,
        participation: { onboardingComplete: true },
        votingActive: false,
        isAdmin: false,
      }),
    ).toBe("/product/h/history");
  });

  it("keeps hackathon discovery and admin routes outside the participant gate", () => {
    expect(bypassesParticipantOnboarding("/product/hackathons")).toBe(true);
    expect(bypassesParticipantOnboarding("/product/admin/users")).toBe(true);
    expect(
      bypassesParticipantOnboarding("/product/h/history/admin/users"),
    ).toBe(true);
  });

  it("keeps voting redirects scoped to the selected event", () => {
    expect(
      productRedirectForParticipation({
        pathname: "/product/h/history/ideas",
        hackathon: historical,
        participation: { onboardingComplete: true },
        votingActive: true,
        isAdmin: false,
      }),
    ).toBe("/product/h/history/voting");
    expect(
      productRedirectForParticipation({
        pathname: "/product/h/history/admin",
        hackathon: historical,
        participation: null,
        votingActive: true,
        isAdmin: true,
      }),
    ).toBeNull();
  });

  it("does not send nonparticipants into read-only event onboarding", () => {
    expect(
      productRedirectForParticipation({
        pathname: "/product/h/history/ideas",
        hackathon: { slug: "history", status: "completed" },
        participation: null,
        votingActive: false,
        isAdmin: false,
      }),
    ).toBe("/product/hackathons");
    expect(
      productRedirectForParticipation({
        pathname: "/product/h/history/onboarding",
        hackathon: { slug: "history", status: "archived" },
        participation: null,
        votingActive: false,
        isAdmin: false,
      }),
    ).toBe("/product/hackathons");
  });
});
