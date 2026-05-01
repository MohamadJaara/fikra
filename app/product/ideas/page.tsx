"use client";

import { IdeaExpandedRow } from "@/components/IdeaExpandedRow";
import { IdeaMasonryItem } from "@/components/IdeaMasonryItem";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IdeaExpandedRowSkeleton,
  IdeaMasonryItemSkeleton,
} from "@/components/Skeleton";
import {
  STATUSES,
  STATUS_LABELS,
  SORT_OPTIONS,
  SORT_LABELS,
} from "@/lib/constants";
import type { SortOption } from "@/lib/constants";
import { useResourcesList, useRolesList } from "@/lib/hooks";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useState } from "react";
import Link from "next/link";
import {
  PlusCircle,
  Search,
  Filter,
  Users,
  Package,
  X,
  ArrowUpDown,
  Sparkles,
  LayoutGrid,
  List,
  Loader2,
} from "lucide-react";
import { FeatureTip } from "@/components/FeatureTip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IdeaListItem } from "@/lib/types";

const PAGE_SIZE = 20;

type FilterState = {
  search: string;
  statuses: string[];
  roles: string[];
  resourceTags: string[];
  categories: Array<Id<"categories"> | "__none__">;
  needsTeammates: boolean;
  needsResources: boolean;
};

export default function BrowseIdeasPage() {
  const categoryList = useQuery(api.categories.list);
  const rolesList = useRolesList();
  const resourcesList = useResourcesList();
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    statuses: [],
    roles: [],
    resourceTags: [],
    categories: [],
    needsTeammates: false,
    needsResources: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<"list" | "masonry">("list");
  const {
    results: ideas,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.ideas.list,
    {
      filters: {
        search: filters.search,
        statuses: filters.statuses,
        roles: filters.roles,
        resourceTags: filters.resourceTags,
        categories: filters.categories,
        needsTeammates: filters.needsTeammates,
        needsResources: filters.needsResources,
      },
      sortBy,
    },
    { initialNumItems: PAGE_SIZE },
  );
  const ideaResults = ideas as IdeaListItem[];

  const activeFilterCount =
    filters.statuses.length +
    filters.roles.length +
    filters.resourceTags.length +
    filters.categories.length +
    (filters.needsTeammates ? 1 : 0) +
    (filters.needsResources ? 1 : 0);

  const toggleStringFilter = (
    key: "statuses" | "roles" | "resourceTags",
    value: string,
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  };

  const toggleCategoryFilter = (value: Id<"categories"> | "__none__") => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(value)
        ? prev.categories.filter((v) => v !== value)
        : [...prev.categories, value],
    }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      statuses: [],
      roles: [],
      resourceTags: [],
      categories: [],
      needsTeammates: false,
      needsResources: false,
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              All Ideas
            </h1>
            <p className="text-sm text-muted-foreground">
              {status === "LoadingFirstPage"
                ? "Loading..."
                : `${ideaResults.length} idea${ideaResults.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link href="/product/ideas/new">
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              New Idea
            </Button>
          </Link>
        </div>

        <FeatureTip tipKey="ideas-filter">
          Use the <strong>Filters</strong> button to find ideas by missing roles, resource needs, or status. Try "Needs Teammates" to find ideas looking for someone with your skills.
        </FeatureTip>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ideas..."
              className="pl-9"
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
            />
          </div>
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
          <Button
            variant="outline"
            onClick={() => {
              setShowFilters(!showFilters);
              try {
                localStorage.setItem("fikra_seen_tips", JSON.stringify([...JSON.parse(localStorage.getItem("fikra_seen_tips") || "[]"), "ideas-filter"]));
              } catch {}
            }}
            className="relative"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
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

        {showFilters && (
          <div className="border-b border-t py-4 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <FilterBadge
                    key={s}
                    label={STATUS_LABELS[s]}
                    active={filters.statuses.includes(s)}
                    onClick={() => toggleStringFilter("statuses", s)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Missing Roles
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rolesList.map((r) => (
                  <FilterBadge
                    key={r.slug}
                    label={r.name}
                    active={filters.roles.includes(r.slug)}
                    onClick={() => toggleStringFilter("roles", r.slug)}
                  />
                ))}
              </div>
            </div>

            {resourcesList.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Resource Needs
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {resourcesList.map((resource) => (
                    <FilterBadge
                      key={resource.slug}
                      label={resource.name}
                      active={filters.resourceTags.includes(resource.slug)}
                      onClick={() =>
                        toggleStringFilter("resourceTags", resource.slug)
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {categoryList && categoryList.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Category</p>
                <div className="flex flex-wrap gap-1.5">
                  <FilterBadge
                    key="__none__"
                    label="No Category"
                    active={filters.categories.includes("__none__")}
                    onClick={() => toggleCategoryFilter("__none__")}
                  />
                  {categoryList.map((cat) => (
                    <FilterBadge
                      key={cat._id}
                      label={cat.name}
                      active={filters.categories.includes(cat._id)}
                      onClick={() => toggleCategoryFilter(cat._id)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <FilterBadge
                label="Needs Teammates"
                icon={<Users className="h-3 w-3" />}
                active={filters.needsTeammates}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    needsTeammates: !prev.needsTeammates,
                  }))
                }
              />
              <FilterBadge
                label="Needs Resources"
                icon={<Package className="h-3 w-3" />}
                active={filters.needsResources}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    needsResources: !prev.needsResources,
                  }))
                }
              />
            </div>
          </div>
        )}
      </div>

      {status === "LoadingFirstPage" ? (
        viewMode === "masonry" ? (
          <div className="columns-1 md:columns-2 lg:columns-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className={`animate-fade-in stagger-${Math.min(i + 1, 9)}`}
              >
                <IdeaMasonryItemSkeleton />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`animate-fade-in stagger-${i + 1}`}>
                <IdeaExpandedRowSkeleton noBorder />
              </div>
            ))}
          </div>
        )
      ) : ideaResults.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4 animate-float">
            {activeFilterCount === 0 && !filters.search ? "💡" : "🔍"}
          </div>
          <p className="text-lg font-medium mb-2">
            {activeFilterCount === 0 && !filters.search
              ? "No ideas yet"
              : "No ideas match your filters"}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {activeFilterCount === 0 && !filters.search
              ? "Be the first to add an idea for the hackathon!"
              : "Try adjusting your filters or search."}
          </p>
          {activeFilterCount === 0 && !filters.search && (
            <Link href="/product/ideas/new">
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add the First Idea
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          {viewMode === "masonry" ? (
            <div className="columns-1 md:columns-2 lg:columns-3">
              {ideaResults.map((idea, i) => (
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
              {ideaResults.map((idea, i) => (
                <div
                  key={idea._id}
                  className={`animate-fade-in stagger-${Math.min(i + 1, 9)}`}
                >
                  <IdeaExpandedRow idea={idea} />
                </div>
              ))}
            </div>
          )}
          {status === "CanLoadMore" && (
            <div className="flex justify-center mt-6">
              <Button variant="outline" onClick={() => loadMore(PAGE_SIZE)}>
                Load more
              </Button>
            </div>
          )}
          {status === "LoadingMore" && (
            <div className="flex justify-center mt-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterBadge({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
        active
          ? "bg-primary text-primary-foreground shadow-sm scale-105"
          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:scale-105"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
