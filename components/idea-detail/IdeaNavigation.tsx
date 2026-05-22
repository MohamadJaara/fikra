"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type Status } from "@/lib/constants";
import type { IdeaNavigation as IdeaNavigationType } from "@/lib/types";

type Direction = "previous" | "next";

function IdeaNavigationLink({
  direction,
  item,
  query,
}: {
  direction: Direction;
  item: NonNullable<IdeaNavigationType[Direction]>;
  query: string;
}) {
  const isNext = direction === "next";
  const label = isNext ? "Next idea" : "Previous idea";
  const Icon = isNext ? ArrowRight : ArrowLeft;
  const href = `/product/ideas/${item._id}${query ? `?${query}` : ""}`;

  return (
    <Link
      href={href}
      className={`group flex min-w-0 flex-1 items-center gap-2.5 py-2 text-sm transition-colors hover:text-foreground ${
        isNext ? "justify-end text-right" : "justify-start"
      }`}
      aria-label={`${label}: ${item.title}`}
    >
      {!isNext && (
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </span>
          <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">
            {STATUS_LABELS[item.status as Status] || item.status}
          </Badge>
        </span>
        <span className="block truncate font-medium">{item.title}</span>
      </span>
      {isNext && (
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      )}
    </Link>
  );
}

function EmptySlot({ direction }: { direction: Direction }) {
  return (
    <div
      className={`flex min-w-0 flex-1 py-2 text-sm text-muted-foreground/50 ${
        direction === "next" ? "justify-end text-right" : "justify-start"
      }`}
    >
      <span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em]">
          {direction === "next" ? "Next idea" : "Previous idea"}
        </span>
        <span className="block text-xs">End of the list</span>
      </span>
    </div>
  );
}

export function IdeaNavigation({
  navigation,
  query = "",
}: {
  navigation: IdeaNavigationType | undefined;
  query?: string;
}) {
  if (navigation === undefined) {
    return (
      <div className="mb-5 grid grid-cols-2 divide-x border-y text-sm">
        <div className="h-[52px] animate-pulse bg-muted/30" />
        <div className="h-[52px] animate-pulse bg-muted/30" />
      </div>
    );
  }

  if (!navigation.previous && !navigation.next) return null;

  return (
    <nav
      className="mb-5 grid grid-cols-1 divide-y border-y sm:grid-cols-2 sm:divide-x sm:divide-y-0"
      aria-label="Adjacent ideas"
    >
      <div className="min-w-0 pr-3 sm:pr-4">
        {navigation.previous ? (
          <IdeaNavigationLink
            direction="previous"
            item={navigation.previous}
            query={query}
          />
        ) : (
          <EmptySlot direction="previous" />
        )}
      </div>
      <div className="min-w-0 pl-0 sm:pl-4">
        {navigation.next ? (
          <IdeaNavigationLink direction="next" item={navigation.next} query={query} />
        ) : (
          <EmptySlot direction="next" />
        )}
      </div>
    </nav>
  );
}
