"use client";

import { AppShell } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { Lightbulb } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

export function ProductLayoutClient({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(
    api.users.viewer,
    !isLoading && isAuthenticated ? {} : "skip",
  );
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/signin");
      return;
    }
    if (viewer === undefined || viewer === null) return;

    const onOnboardingPage = pathname === "/product/onboarding";

    if (!viewer.onboardingComplete && !onOnboardingPage) {
      router.replace("/product/onboarding");
    } else if (viewer.onboardingComplete && onOnboardingPage) {
      router.replace("/product");
    }
  }, [isLoading, isAuthenticated, viewer, pathname, router]);

  if (isLoading || viewer === undefined) {
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
  if (!viewer.onboardingComplete && !onOnboardingPage) return null;
  if (viewer.onboardingComplete && onOnboardingPage) return null;

  return <AppShell viewer={viewer}>{children}</AppShell>;
}
