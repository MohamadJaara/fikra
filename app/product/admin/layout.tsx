"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { Shield } from "lucide-react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = useQuery(api.users.viewer);
  const router = useRouter();

  useEffect(() => {
    if (viewer !== undefined && viewer !== null && !viewer.isAdmin) {
      router.replace("/product");
    }
  }, [viewer, router]);

  if (viewer === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Shield className="h-8 w-8 text-muted-foreground animate-pulse" />
          <div className="text-muted-foreground text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  if (!viewer?.isAdmin) return null;

  return <>{children}</>;
}
