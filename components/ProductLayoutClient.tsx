"use client";

import { AppShell } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useQuery } from "convex/react";
import { Lightbulb } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, ReactNode, use, useEffect } from "react";

type ProductViewer = NonNullable<
  FunctionReturnType<typeof api.users.viewerOrNull>
>;

const ProductViewerContext = createContext<ProductViewer | null>(null);

export function useProductViewer() {
  const viewer = use(ProductViewerContext);
  if (!viewer) {
    throw new Error("useProductViewer must be used within ProductLayoutClient");
  }
  return viewer;
}

export function ProductLayoutClient({ children }: { children: ReactNode }) {
  const viewer = useQuery(api.users.viewerOrNull);
  const votingStatus = useQuery(api.voting.status, viewer ? {} : "skip");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (viewer === undefined) return;
    if (viewer === null) {
      router.replace("/signin");
      return;
    }

    const onOnboardingPage = pathname === "/product/onboarding";
    const onVotingPage = pathname === "/product/voting";

    if (!viewer.onboardingComplete && !onOnboardingPage) {
      router.replace("/product/onboarding");
    } else if (viewer.onboardingComplete && onOnboardingPage) {
      router.replace("/product");
    } else if (
      viewer.onboardingComplete &&
      votingStatus?.active &&
      !onVotingPage
    ) {
      router.replace("/product/voting");
    }
  }, [viewer, votingStatus, pathname, router]);

  if (viewer === undefined || (viewer !== null && votingStatus === undefined)) {
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

  const onOnboardingPage = pathname === "/product/onboarding";
  const onVotingPage = pathname === "/product/voting";
  if (!viewer.onboardingComplete && !onOnboardingPage) return null;
  if (viewer.onboardingComplete && onOnboardingPage) return null;
  if (viewer.onboardingComplete && votingStatus?.active && !onVotingPage) {
    return null;
  }

  return (
    <ProductViewerContext value={viewer}>
      <AppShell viewer={viewer}>{children}</AppShell>
    </ProductViewerContext>
  );
}
