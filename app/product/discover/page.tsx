"use client";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Heart,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityTicker } from "./activity-ticker";
import { DiscoverIdeaCard } from "./idea-card";
import type { DiscoverIdeaCardData } from "./idea-card";
import { EmptyDiscoverState } from "./empty-state";
import { useProductViewer } from "@/components/ProductLayoutClient";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

type Mode = "browse" | "findTeam";

type SwipeEntry = {
  ideaId: Id<"ideas">;
  direction: "left" | "right";
};

export default function DiscoverPage() {
  const viewer = useProductViewer();
  const [mode, setMode] = useState<Mode>("browse");
  const [swipedIds, setSwipedIds] = useState<Set<Id<"ideas">>>(new Set());
  const [swipeHistory, setSwipeHistory] = useState<SwipeEntry[]>([]);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const swipingRef = useRef(false);

  const ideas = useQuery(api.discover.getDiscoverFeed, { mode });
  const dismiss = useMutation(api.discover.dismissIdea);
  const expressInterest = useMutation(api.interest.express);
  const removeInterest = useMutation(api.interest.remove);
  const undoDismiss = useMutation(api.discover.undoDismissIdea);
  const resetDismissed = useMutation(api.discover.resetDismissedIdeas);
  const [isResetting, setIsResetting] = useState(false);

  const remaining = useMemo(() => {
    if (!ideas) return [];
    return ideas.filter((idea) => !swipedIds.has(idea._id));
  }, [ideas, swipedIds]);

  const currentIdea = remaining[0]
    ? (remaining[0] as unknown as DiscoverIdeaCardData)
    : null;
  const nextIdea = remaining[1]
    ? (remaining[1] as unknown as DiscoverIdeaCardData)
    : null;

  const handleSwipe = useCallback(
    (dir: "left" | "right") => {
      if (!currentIdea || swipingRef.current) return;
      swipingRef.current = true;
      setDirection(dir);

      const ideaId = currentIdea._id as Id<"ideas">;

      if (dir === "right") {
        toast.promise(
          expressInterest({ ideaId }),
          {
            loading: "Showing interest...",
            success: `Interested in "${currentIdea.title}"`,
            error: "Failed to express interest",
          },
        );
      } else {
        void dismiss({ ideaId });
      }

      setTimeout(() => {
        setSwipedIds((prev) => {
          const next = new Set(prev);
          next.add(ideaId);
          return next;
        });
        setSwipeHistory((prev) => [...prev, { ideaId, direction: dir }]);
        setDirection(null);
        swipingRef.current = false;
      }, 200);
    },
    [currentIdea, expressInterest, dismiss],
  );

  const handleUndo = useCallback(async () => {
    if (swipeHistory.length === 0) return;
    const last = swipeHistory[swipeHistory.length - 1];

    setSwipedIds((prev) => {
      const next = new Set(prev);
      next.delete(last.ideaId);
      return next;
    });
    setSwipeHistory((prev) => prev.slice(0, -1));

    if (last.direction === "left") {
      await undoDismiss({ ideaId: last.ideaId });
    } else {
      await removeInterest({ ideaId: last.ideaId });
    }
  }, [swipeHistory, undoDismiss, removeInterest]);

  const handleModeChange = useCallback((newMode: Mode) => {
    setMode(newMode);
    setSwipedIds(new Set());
    setSwipeHistory([]);
    setDirection(null);
  }, []);

  const handleStartOver = useCallback(async () => {
    setIsResetting(true);
    try {
      await resetDismissed();
      setSwipedIds(new Set());
      setSwipeHistory([]);
      setDirection(null);
    } finally {
      setIsResetting(false);
    }
  }, [resetDismissed]);

  const userRoles = (viewer as any)?.roles ?? [];

  const isLoading = ideas === undefined;

  const reviewedCount = swipeHistory.length;
  const totalCount = ideas?.length ?? 0;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="px-4 md:px-6 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold">Discover</h1>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            <Button
              variant={mode === "browse" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleModeChange("browse")}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Browse Ideas</span>
              <span className="sm:hidden">Browse</span>
            </Button>
            <Button
              variant={mode === "findTeam" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleModeChange("findTeam")}
              className="gap-1.5"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Find a Team</span>
              <span className="sm:hidden">Teams</span>
            </Button>
          </div>
        </div>

        {mode === "findTeam" && (
          <p className="text-sm text-muted-foreground mb-2">
            Swipe right on ideas where you&apos;d like to join the team. Ideas are sorted by role match.
          </p>
        )}

        <ActivityTicker />
      </div>

      <div className="flex-1 relative px-4 md:px-6 pb-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center gap-3">
              <div className="h-80 w-full max-w-md rounded-2xl bg-muted" />
              <p className="text-sm text-muted-foreground">Loading ideas...</p>
            </div>
          </div>
        ) : !currentIdea ? (
          <EmptyDiscoverState mode={mode} onStartOver={handleStartOver} isResetting={isResetting} />
        ) : (
          <div className="h-full relative max-w-lg mx-auto">
            <AnimatePresence mode="popLayout">
              {nextIdea && (
                <DiscoverIdeaCard
                  key={`next-${nextIdea._id}`}
                  idea={nextIdea}
                  onSwipe={() => {}}
                  onTap={() => {}}
                  isTop={false}
                  userRoles={userRoles}
                />
              )}
              {currentIdea && (
                <motion.div
                  key={currentIdea._id}
                  exit={{
                    x: direction === "right" ? 300 : direction === "left" ? -300 : 0,
                    opacity: 0,
                    rotate: direction === "right" ? 15 : direction === "left" ? -15 : 0,
                  }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0"
                >
                  <DiscoverIdeaCard
                    idea={currentIdea}
                    onSwipe={handleSwipe}
                    onTap={() => {
                      window.open(
                        `/product/ideas/${currentIdea._id}`,
                        "_blank",
                      );
                    }}
                    isTop={true}
                    userRoles={userRoles}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-800 dark:hover:bg-red-950"
                onClick={() => handleSwipe("left")}
              >
                <X className="h-6 w-6" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={handleUndo}
                disabled={swipeHistory.length === 0}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                className="h-12 w-12 rounded-full bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleSwipe("right")}
              >
                <Heart className="h-6 w-6" />
              </Button>
            </div>

            {ideas && totalCount > 0 && (
              <div className="absolute top-3 right-3 z-20">
                <Badge counter={`${reviewedCount + 1}/${totalCount}`} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ counter }: { counter: string }) {
  return (
    <div className="rounded-full bg-background/80 backdrop-blur-sm border px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {counter}
    </div>
  );
}
