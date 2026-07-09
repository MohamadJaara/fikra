import { isAdminPathname } from "./adminRoutes";

type RoutableHackathon = {
  slug: string;
  status?: "draft" | "upcoming" | "active" | "completed" | "archived";
};
type ParticipationState = { onboardingComplete?: boolean } | null;

export function hackathonSlugFromPathname(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const hIndex = parts.indexOf("h");
  if (hIndex === -1) return null;
  return parts[hIndex + 1] ?? null;
}

export function productBaseForHackathon(
  hackathon: RoutableHackathon | null,
  pathname?: string,
) {
  if (hackathon && pathname?.startsWith(`/product/h/${hackathon.slug}`)) {
    return `/product/h/${hackathon.slug}`;
  }
  return "/product";
}

export function bypassesParticipantOnboarding(pathname: string) {
  return pathname === "/product/hackathons" || isAdminPathname(pathname);
}

export function productRedirectForParticipation({
  pathname,
  hackathon,
  participation,
  votingActive,
  isAdmin,
}: {
  pathname: string;
  hackathon: RoutableHackathon | null;
  participation: ParticipationState;
  votingActive: boolean;
  isAdmin: boolean;
}) {
  if (bypassesParticipantOnboarding(pathname)) return null;

  if (!hackathon) {
    return pathname === "/product/onboarding" ? "/product/hackathons" : null;
  }

  const productBase = productBaseForHackathon(hackathon, pathname);
  const onboardingPath = `${productBase}/onboarding`;
  const votingPath = `${productBase}/voting`;
  const onOnboardingPage = pathname === onboardingPath;
  const onboarded = participation?.onboardingComplete === true;
  const readOnly =
    hackathon.status === "completed" || hackathon.status === "archived";

  if (!onboarded && readOnly) return "/product/hackathons";
  if (!onboarded && !onOnboardingPage) return onboardingPath;
  if (onboarded && onOnboardingPage) return productBase;
  if (onboarded && votingActive && !isAdmin && pathname !== votingPath) {
    return votingPath;
  }
  return null;
}
