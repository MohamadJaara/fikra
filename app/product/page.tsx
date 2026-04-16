"use client";

import { IdeaCard } from "@/components/IdeaCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IdeaCardSkeleton } from "@/components/Skeleton";
import {
  STATUSES,
  STATUS_LABELS,
  SORT_OPTIONS,
  SORT_LABELS,
} from "@/lib/constants";
import type { SortOption } from "@/lib/constants";
import { useResourcesList, useRolesList } from "@/lib/hooks";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useState, useMemo } from "react";
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
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IdeaListItem } from "@/lib/types";

type FilterState = {
  search: string;
  statuses: string[];
  roles: string[];
  resourceTags: string[];
  categories: string[];
  needsTeammates: boolean;
  needsResources: boolean;
};

export default function BrowsePage() {
  const ideas = useQuery(api.ideas.list) as IdeaListItem[] | undefined;
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

  const filtered = useMemo(() => {
    if (!ideas) return [];
    const result = ideas.filter((idea) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !idea.title.toLowerCase().includes(q) &&
          !idea.pitch.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (
        filters.statuses.length > 0 &&
        !filters.statuses.includes(idea.status)
      ) {
        return false;
      }
      if (
        filters.roles.length > 0 &&
        !filters.roles.some((r) => idea.missingRoles.includes(r))
      ) {
        return false;
      }
      if (
        filters.resourceTags.length > 0 &&
        !filters.resourceTags.some((t) =>
          idea.resourceRequests.some((rr) => rr.tag === t && !rr.resolved),
        )
      ) {
        return false;
      }
      if (
        filters.categories.length > 0 &&
        !filters.categories.some((c) =>
          c === "__none__" ? !idea.categoryId : idea.categoryId === c,
        )
      ) {
        return false;
      }
      if (filters.needsTeammates && idea.memberCount >= idea.teamSizeWanted) {
        return false;
      }
      if (filters.needsResources && !idea.hasUnresolvedResources) {
        return false;
      }
      return true;
    });

    const totalReactions = (idea: IdeaListItem) =>
      Object.values(idea.reactionCounts).reduce((a, b) => a + b, 0);

    switch (sortBy) {
      case "oldest":
        result.sort((a, b) => a._creationTime - b._creationTime);
        break;
      case "most_reactions":
        result.sort((a, b) => totalReactions(b) - totalReactions(a));
        break;
      case "most_interest":
        result.sort((a, b) => b.interestCount - a.interestCount);
        break;
      default:
        result.sort((a, b) => b._creationTime - a._creationTime);
    }

    return result;
  }, [ideas, filters, sortBy]);

  const activeFilterCount =
    filters.statuses.length +
    filters.roles.length +
    filters.resourceTags.length +
    filters.categories.length +
    (filters.needsTeammates ? 1 : 0) +
    (filters.needsResources ? 1 : 0);

  const toggleFilter = (
    key: "statuses" | "roles" | "resourceTags" | "categories",
    value: string,
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
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
              Browse Ideas
            </h1>
            <p className="text-sm text-muted-foreground">
              {ideas ? `${ideas.length} ideas` : "Loading..."}
            </p>
          </div>
          <Link href="/product/ideas/new">
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              New Idea
            </Button>
          </Link>
        </div>

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
            onClick={() => setShowFilters(!showFilters)}
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
        </div>

        {showFilters && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30 animate-fade-in">
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
                    onClick={() => toggleFilter("statuses", s)}
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
                    onClick={() => toggleFilter("roles", r.slug)}
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
                        toggleFilter("resourceTags", resource.slug)
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
                    onClick={() => toggleFilter("categories", "__none__")}
                  />
                  {categoryList.map((cat) => (
                    <FilterBadge
                      key={cat._id}
                      label={cat.name}
                      active={filters.categories.includes(cat._id)}
                      onClick={() => toggleFilter("categories", cat._id)}
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

      {ideas === undefined ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`animate-fade-in stagger-${i + 1}`}>
              <IdeaCardSkeleton />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4 animate-float">
            {ideas.length === 0 ? "💡" : "🔍"}
          </div>
          <p className="text-lg font-medium mb-2">
            {ideas.length === 0
              ? "No ideas yet"
              : "No ideas match your filters"}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {ideas.length === 0
              ? "Be the first to add an idea for the hackathon!"
              : "Try adjusting your filters or search."}
          </p>
          {ideas.length === 0 && (
            <Link href="/product/ideas/new">
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add the First Idea
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((idea, i) => (
            <div
              key={idea._id}
              className={`animate-fade-in stagger-${Math.min(i + 1, 9)}`}
            >
              <IdeaCard idea={idea} />
            </div>
          ))}
        </div>
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
