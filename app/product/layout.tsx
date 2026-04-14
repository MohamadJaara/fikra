import ConvexClientProvider from "@/components/ConvexClientProvider";
import { AppShell } from "@/components/AppShell";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { ReactNode } from "react";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      <OnboardingGuard>
        <AppShell>{children}</AppShell>
      </OnboardingGuard>
    </ConvexClientProvider>
  );
}
