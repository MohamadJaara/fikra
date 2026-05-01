"use client";

import { Lightbulb, Users } from "lucide-react";
import Link from "next/link";

export function EmptyDiscoverState({ mode }: { mode: "browse" | "findTeam" }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      {mode === "browse" ? (
        <>
          <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            You&apos;ve seen all the ideas!
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            You&apos;ve gone through all available ideas. Check back later for new ones, or create your own.
          </p>
          <Link
            href="/product/ideas/new"
            className="text-sm text-primary hover:underline"
          >
            Create an idea
          </Link>
        </>
      ) : (
        <>
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            No teams looking for members right now
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            All teams are either full or not actively recruiting. Check back later or create your own idea.
          </p>
          <Link
            href="/product/ideas/new"
            className="text-sm text-primary hover:underline"
          >
            Create an idea
          </Link>
        </>
      )}
    </div>
  );
}
