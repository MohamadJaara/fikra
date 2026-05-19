"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { IdeaMasonryItem } from "@/components/IdeaMasonryItem";
import { IdeaExpandedRow } from "@/components/IdeaExpandedRow";
import {
  IdeaExpandedRowSkeleton,
  IdeaMasonryItemSkeleton,
} from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import {
  SORT_OPTIONS,
  SORT_LABELS,
  type SortOption,
} from "@/lib/constants";
import type { IdeaListItem } from "@/lib/types";
import {
  Bookmark,
  LayoutGrid,
  List,
  ArrowUpDown,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SavedIdeasPage() {
  const bookmarkedIdeas = useQuery(api.ideas.getBookmarked) as
    | IdeaListItem[]
    | undefined;
  const [viewMode, setViewMode] = useState<"list" | "masonry">("masonry");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const sortedIdeas = useMemo(() => {
    if (!bookmarkedIdeas) return [];
    const sorted = [...bookmarkedIdeas];
    switch (sortBy) {
      case "oldest":
        sorted.sort((a, b) => a._creationTime - b._creationTime);
        break;
      case "most_reactions": {
        const total = (idea: IdeaListItem) =>
          Object.values(idea.reactionCounts).reduce((s, n) => s + n, 0);
        sorted.sort((a, b) => total(b) - total(a));
        break;
      }
      case "most_interest":
        sorted.sort((a, b) => b.interestCount - a.interestCount);
        break;
      default:
        sorted.sort((a, b) => b._creationTime - a._creationTime);
    }
    return sorted;
  }, [bookmarkedIdeas, sortBy]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-amber-500 fill-amber-500" />
              Saved Ideas
            </h1>
            <p className="text-sm text-muted-foreground">
              {bookmarkedIdeas === undefined
                ? "Loading..."
                : `${bookmarkedIdeas.length} saved idea${bookmarkedIdeas.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {bookmarkedIdeas !== undefined && bookmarkedIdeas.length > 0 && (
          <div className="flex gap-2">
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortOption)}
            >
              <SelectTrigger className="w-[170px]">
                <ArrowUpDown className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {SORT_LABELS[opt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-r-none"
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "masonry" ? "secondary" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-l-none"
                onClick={() => setViewMode("masonry")}
                aria-label="Masonry view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {bookmarkedIdeas === undefined ? (
        viewMode === "masonry" ? (
          <div className="columns-1 md:columns-2 lg:columns-3">
            {/* eslint-disable @eslint-react/no-array-index-key */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`animate-fade-in stagger-${Math.min(i + 1, 9)}`}
              >
                <IdeaMasonryItemSkeleton />
              </div>
            ))}
            {/* eslint-enable @eslint-react/no-array-index-key */}
          </div>
        ) : (
          <div className="divide-y">
            {/* eslint-disable @eslint-react/no-array-index-key */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`animate-fade-in stagger-${i + 1}`}>
                <IdeaExpandedRowSkeleton noBorder />
              </div>
            ))}
            {/* eslint-enable @eslint-react/no-array-index-key */}
          </div>
        )
      ) : sortedIdeas.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4 animate-float">
            <Bookmark className="h-12 w-12 mx-auto text-muted-foreground/30" />
          </div>
          <p className="text-lg font-medium mb-2">No saved ideas yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Bookmark ideas you want to revisit later. They&apos;ll show up here.
          </p>
          <Link href="/product/ideas">
            <Button>
              <Sparkles className="h-4 w-4 mr-2" />
              Browse Ideas
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {viewMode === "masonry" ? (
            <div className="columns-1 md:columns-2 lg:columns-3">
              {sortedIdeas.map((idea, i) => (
                <div
                  key={idea._id}
                  className={`animate-fade-in stagger-${Math.min(i + 1, 9)}`}
                >
                  <IdeaMasonryItem idea={idea} />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y">
              {sortedIdeas.map((idea, i) => (
                <div
                  key={idea._id}
                  className={`animate-fade-in stagger-${Math.min(i + 1, 9)}`}
                >
                  <IdeaExpandedRow idea={idea} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
