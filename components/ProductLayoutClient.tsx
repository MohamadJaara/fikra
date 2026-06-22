"use client";

import { AppShell } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useQuery } from "convex/react";
import { Lightbulb } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, ReactNode, use, useEffect, useMemo } from "react";

type ProductViewer = NonNullable<
  FunctionReturnType<typeof api.users.viewerOrNull>
>;
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

function hackathonSlugFromPathname(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const hIndex = parts.indexOf("h");
  if (hIndex === -1) return null;
  return parts[hIndex + 1] ?? null;
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
  const votingStatus = useQuery(
    api.voting.status,
    viewer && selectedHackathon
      ? { hackathonId: selectedHackathon._id }
      : viewer && selectedHackathon === null
        ? {}
        : "skip",
  );

  useEffect(() => {
    if (viewer === undefined || selectedHackathon === undefined) return;
    if (viewer === null) {
      router.replace("/signin");
      return;
    }

    const onOnboardingPage = pathname === "/product/onboarding";
    const onVotingPage =
      pathname === "/product/voting" || pathname.endsWith("/voting");

    if (!viewer.onboardingComplete && !onOnboardingPage) {
      router.replace("/product/onboarding");
    } else if (viewer.onboardingComplete && onOnboardingPage) {
      router.replace("/product");
    } else if (
      viewer.onboardingComplete &&
      votingStatus?.active &&
      !viewer.isAdmin &&
      !onVotingPage
    ) {
      router.replace("/product/voting");
    }
  }, [viewer, selectedHackathon, votingStatus, pathname, router]);

  if (
    viewer === undefined ||
    selectedHackathon === undefined ||
    (viewer !== null && selectedHackathon !== null && votingStatus === undefined)
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
  if (selectedHackathon === null && hackathonSlug) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">
          Hackathon not found.
        </div>
      </div>
    );
  }

  const onOnboardingPage = pathname === "/product/onboarding";
  const onVotingPage =
    pathname === "/product/voting" || pathname.endsWith("/voting");
  if (!viewer.onboardingComplete && !onOnboardingPage) return null;
  if (viewer.onboardingComplete && onOnboardingPage) return null;
  if (
    viewer.onboardingComplete &&
    votingStatus?.active &&
    !viewer.isAdmin &&
    !onVotingPage
  ) {
    return null;
  }

  return (
    <ProductViewerContext value={viewer}>
      <ProductHackathonContext value={selectedHackathon}>
        <AppShell viewer={viewer} hackathon={selectedHackathon}>
          {children}
        </AppShell>
      </ProductHackathonContext>
    </ProductViewerContext>
  );
}
