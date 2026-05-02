"use client";

import { Lightbulb, RotateCcw, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyDiscoverState({
  mode,
  onStartOver,
  isResetting,
}: {
  mode: "browse" | "findTeam";
  onStartOver: () => void;
  isResetting: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      {mode === "browse" ? (
        <>
          <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            You&apos;ve seen all the ideas!
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            You&apos;ve gone through all available ideas. Start over to see them again, or create your own.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onStartOver}
              disabled={isResetting}
              className="gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              {isResetting ? "Resetting..." : "Start Over"}
            </Button>
            <Link
              href="/product/ideas/new"
              className="text-sm text-primary hover:underline"
            >
              Create an idea
            </Link>
          </div>
        </>
      ) : (
        <>
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            No teams looking for members right now
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            All teams are either full or not actively recruiting. Start over to see them again, or create your own idea.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onStartOver}
              disabled={isResetting}
              className="gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              {isResetting ? "Resetting..." : "Start Over"}
            </Button>
            <Link
              href="/product/ideas/new"
              className="text-sm text-primary hover:underline"
            >
              Create an idea
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
