"use client";

import type { ReactNode } from "react";
import { IdeaExpandedRow } from "@/components/IdeaExpandedRow";
import { IdeaMasonryItem } from "@/components/IdeaMasonryItem";
import {
  IdeaExpandedRowSkeleton,
  IdeaMasonryItemSkeleton,
} from "@/components/Skeleton";
import type { IdeaListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export type IdeaViewMode = "list" | "masonry";

type LayoutProps = {
  viewMode: IdeaViewMode;
  className?: string;
};

function IdeaCollectionLayout({
  viewMode,
  className,
  children,
}: LayoutProps & { children: ReactNode }) {
  return (
    <div
      className={cn(
        viewMode === "masonry"
          ? "columns-1 md:columns-2 lg:columns-3"
          : "divide-y",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function IdeaCollection({
  ideas,
  viewMode,
  getIdeaHref,
  className,
}: LayoutProps & {
  ideas: readonly IdeaListItem[];
  getIdeaHref: (ideaId: IdeaListItem["_id"]) => string;
}) {
  const Item = viewMode === "masonry" ? IdeaMasonryItem : IdeaExpandedRow;

  return (
    <IdeaCollectionLayout viewMode={viewMode} className={className}>
      {ideas.map((idea, index) => (
        <div
          key={idea._id}
          className={`animate-fade-in stagger-${Math.min(index + 1, 9)}`}
        >
          <Item idea={idea} href={getIdeaHref(idea._id)} />
        </div>
      ))}
    </IdeaCollectionLayout>
  );
}

export function IdeaCollectionSkeleton({
  viewMode,
  count = 6,
  className,
}: LayoutProps & { count?: number }) {
  const Item =
    viewMode === "masonry" ? IdeaMasonryItemSkeleton : IdeaExpandedRowSkeleton;
  const keys = Array.from({ length: count }, (_, index) => `skeleton-${index}`);

  return (
    <IdeaCollectionLayout viewMode={viewMode} className={className}>
      {keys.map((key, index) => (
        <div
          key={key}
          className={`animate-fade-in stagger-${Math.min(index + 1, 9)}`}
        >
          <Item />
        </div>
      ))}
    </IdeaCollectionLayout>
  );
}
