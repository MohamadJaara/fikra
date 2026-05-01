"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { ReactNode, useEffect } from "react";

export function OnboardingGuard({ children }: { children: ReactNode }) {
  const viewer = useQuery(api.users.viewerOrNull);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (viewer === undefined) return;
    if (viewer === null) return;

    const onOnboardingPage = pathname === "/product/onboarding";

    if (!viewer.onboardingComplete && !onOnboardingPage) {
      router.replace("/product/onboarding");
    } else if (viewer.onboardingComplete && onOnboardingPage) {
      router.replace("/product");
    }
  }, [viewer, pathname, router]);

  if (viewer === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (viewer === null) return null;

  const onOnboardingPage = pathname === "/product/onboarding";
  if (!viewer.onboardingComplete && !onOnboardingPage) return null;
  if (viewer.onboardingComplete && onOnboardingPage) return null;

  return <>{children}</>;
}
