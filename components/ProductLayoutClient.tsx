"use client";

import { AppShell } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useQuery } from "convex/react";
import { Lightbulb } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, ReactNode, use, useEffect, useMemo } from "react";
import {
  bypassesParticipantOnboarding,
  hackathonSlugFromPathname,
  productBaseForHackathon,
  productRedirectForParticipation,
} from "@/lib/productRouting";

type ProductViewer = NonNullable<
  FunctionReturnType<typeof api.users.viewerOrNull>
> & { availabilityNote?: string };
type ProductHackathon = NonNullable<
  FunctionReturnType<typeof api.hackathons.getCurrent>
>;

const ProductViewerContext = createContext<ProductViewer | null>(null);
const ProductHackathonContext = createContext<ProductHackathon | null>(null);

export function useProductViewer() {
  const viewer = use(ProductViewerContext);
  if (!viewer) {
    throw new Error("useProductViewer must be used within ProductLayoutClient");
  }
  return viewer;
}

export function useSelectedHackathon() {
  return use(ProductHackathonContext);
}

export { productBaseForHackathon } from "@/lib/productRouting";

export function useProductBase() {
  const pathname = usePathname();
  return productBaseForHackathon(useSelectedHackathon(), pathname);
}

export function ProductLayoutClient({ children }: { children: ReactNode }) {
  const viewer = useQuery(api.users.viewerOrNull);
  const router = useRouter();
  const pathname = usePathname();
  const hackathonSlug = useMemo(
    () => hackathonSlugFromPathname(pathname),
    [pathname],
  );
  const currentHackathon = useQuery(
    api.hackathons.getCurrent,
    viewer && !hackathonSlug ? {} : "skip",
  );
  const slugHackathon = useQuery(
    api.hackathons.getBySlug,
    viewer && hackathonSlug ? { slug: hackathonSlug } : "skip",
  );
  const selectedHackathon = hackathonSlug ? slugHackathon : currentHackathon;
  const bypassParticipantOnboarding = bypassesParticipantOnboarding(pathname);
  const participation = useQuery(
    api.users.getMyParticipation,
    viewer && selectedHackathon && !bypassParticipantOnboarding
      ? { hackathonId: selectedHackathon._id }
      : "skip",
  );
  const shouldLoadVoting = Boolean(
    viewer &&
    selectedHackathon &&
    !bypassParticipantOnboarding &&
    participation?.onboardingComplete,
  );
  const votingStatus = useQuery(
    api.voting.status,
    shouldLoadVoting && selectedHackathon
      ? { hackathonId: selectedHackathon._id }
      : "skip",
  );

  const effectiveViewer = useMemo<ProductViewer | null | undefined>(() => {
    if (!viewer || !selectedHackathon || bypassParticipantOnboarding) {
      return viewer;
    }
    if (participation === undefined) return viewer;
    return {
      ...viewer,
      roles: participation?.roles ?? [],
      participationMode: participation?.participationMode,
      onboardingComplete: participation?.onboardingComplete === true,
      availabilityNote: participation?.availabilityNote,
    };
  }, [bypassParticipantOnboarding, participation, selectedHackathon, viewer]);

  const redirectTo =
    viewer &&
    selectedHackathon !== undefined &&
    (bypassParticipantOnboarding ||
      selectedHackathon === null ||
      participation !== undefined)
      ? productRedirectForParticipation({
          pathname,
          hackathon: selectedHackathon,
          participation: participation ?? null,
          votingActive: votingStatus?.active === true,
          isAdmin: viewer.isAdmin === true,
        })
      : null;

  useEffect(() => {
    if (viewer === undefined) return;
    if (viewer === null) {
      router.replace("/signin");
      return;
    }
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router, viewer]);

  if (
    viewer === undefined ||
    (viewer !== null && selectedHackathon === undefined) ||
    (viewer !== null &&
      selectedHackathon !== null &&
      !bypassParticipantOnboarding &&
      participation === undefined) ||
    (shouldLoadVoting && votingStatus === undefined)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Lightbulb className="h-8 w-8 animate-float text-yellow-500" />
          <div className="h-4 w-24 animate-shimmer rounded" />
        </div>
      </div>
    );
  }

  if (viewer === null) return null;
  if (selectedHackathon === undefined) return null;
  if (selectedHackathon === null && hackathonSlug) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">
          Hackathon not found.
        </div>
      </div>
    );
  }

  if (redirectTo) return null;

  return (
    <ProductViewerContext value={effectiveViewer ?? viewer}>
      <ProductHackathonContext value={selectedHackathon}>
        <AppShell
          viewer={effectiveViewer ?? viewer}
          hackathon={selectedHackathon}
        >
          {children}
        </AppShell>
      </ProductHackathonContext>
    </ProductViewerContext>
  );
}
