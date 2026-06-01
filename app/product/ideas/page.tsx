"use client";

import { IdeaExpandedRow } from "@/components/IdeaExpandedRow";
import { IdeaMasonryItem } from "@/components/IdeaMasonryItem";
import { Input } from "@/components/ui/input";
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
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  PlusCircle,
  Search,
  Users,
  Package,
  X,
  ArrowUpDown,
  LayoutGrid,
  List,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IdeaListItem } from "@/lib/types";

const PAGE_SIZE = 60;

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
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Ideas
              </h1>
              <div className="h-4 w-20 animate-shimmer rounded mt-2" />
            </div>
          </div>
          <div className="divide-y divide-border/40">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`animate-fade-in stagger-${i + 1}`}>
                <IdeaExpandedRowSkeleton />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <BrowseIdeasContent />
    </Suspense>
  );
}

function BrowseIdeasContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const categoryList = useQuery(api.categories.list);
  const rolesList = useRolesList();
  const resourcesList = useResourcesList();
  const [filters, setFilters] = useState<FilterState>({
    search: searchParams.get("search") || "",
    statuses: searchParams.get("statuses")?.split(",").filter(Boolean) ?? [],
    roles: searchParams.get("roles")?.split(",").filter(Boolean) ?? [],
    resourceTags:
      searchParams.get("resourceTags")?.split(",").filter(Boolean) ?? [],
    categories:
      (searchParams
        .get("categories")
        ?.split(",")
        .filter(Boolean) as Array<Id<"categories"> | "__none__">) ?? [],
    needsTeammates: searchParams.get("needsTeammates") === "1",
    needsResources: searchParams.get("needsResources") === "1",
  });
  const [showFilters, setShowFilters] = useState(
    searchParams.has("statuses") ||
      searchParams.has("roles") ||
      searchParams.has("resourceTags") ||
      searchParams.has("categories") ||
      searchParams.has("needsTeammates") ||
      searchParams.has("needsResources"),
  );
  const [sortBy, setSortBy] = useState<SortOption>(
    (searchParams.get("sort") as SortOption) || "most_interest",
  );
  const [viewMode, setViewMode] = useState<"list" | "masonry">(
    (searchParams.get("view") as "list" | "masonry") || "list",
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (sortBy !== "most_interest") params.set("sort", sortBy);
    if (viewMode !== "list") params.set("view", viewMode);
    if (filters.search) params.set("search", filters.search);
    if (filters.statuses.length)
      params.set("statuses", filters.statuses.join(","));
    if (filters.roles.length) params.set("roles", filters.roles.join(","));
    if (filters.resourceTags.length)
      params.set("resourceTags", filters.resourceTags.join(","));
    if (filters.categories.length)
      params.set("categories", filters.categories.join(","));
    if (filters.needsTeammates) params.set("needsTeammates", "1");
    if (filters.needsResources) params.set("needsResources", "1");
    const qs = params.toString();
    const current = searchParams.toString();
    if (qs !== current) {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  }, [filters, sortBy, viewMode]);
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
  const ideaCount = useQuery(api.ideas.count, {
    filters: {
      search: filters.search,
      statuses: filters.statuses,
      roles: filters.roles,
      resourceTags: filters.resourceTags,
      categories: filters.categories,
      needsTeammates: filters.needsTeammates,
      needsResources: filters.needsResources,
    },
  });
  const remainingIdeaCount =
    typeof ideaCount === "number"
      ? Math.max(ideaCount - ideaResults.length, 0)
      : null;

  const activeFilterCount =
    filters.statuses.length +
    filters.roles.length +
    filters.resourceTags.length +
    filters.categories.length +
    (filters.needsTeammates ? 1 : 0) +
    (filters.needsResources ? 1 : 0);

  const browseContextQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("sort", sortBy);
    if (viewMode !== "list") params.set("view", viewMode);
    if (filters.search) params.set("search", filters.search);
    if (filters.statuses.length)
      params.set("statuses", filters.statuses.join(","));
    if (filters.roles.length) params.set("roles", filters.roles.join(","));
    if (filters.resourceTags.length)
      params.set("resourceTags", filters.resourceTags.join(","));
    if (filters.categories.length)
      params.set("categories", filters.categories.join(","));
    if (filters.needsTeammates) params.set("needsTeammates", "1");
    if (filters.needsResources) params.set("needsResources", "1");
    return params.toString();
  }, [filters, sortBy, viewMode]);

  const ideaDetailHref = (ideaId: Id<"ideas">) =>
    `/product/ideas/${ideaId}?${browseContextQuery}`;

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
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="flex items-end justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Ideas
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 font-mono tabular-nums">
            {status === "LoadingFirstPage" || ideaCount === undefined
              ? "loading..."
              : `${ideaCount} idea${ideaCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href="/product/ideas/new">
          <Button>
            <PlusCircle className="h-4 w-4 mr-2" />
            New Idea
          </Button>
        </Link>
      </div>

      <div
        className="flex items-center gap-2 mb-2 animate-fade-in"
        style={{ animationDelay: "0.05s" }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Search ideas..."
            className="pl-8 border-0 border-b rounded-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-foreground/40 h-9 transition-colors"
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
          <SelectTrigger className="w-[160px] border-0 border-b rounded-none shadow-none focus:ring-0 h-9">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground/60" />
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
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="relative h-9 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filter</span>
          {activeFilterCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground text-background text-[10px] font-semibold px-1">
              {activeFilterCount}
            </span>
          )}
        </Button>
        <div className="flex rounded-md border border-border/60 ml-1">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-r-none"
            onClick={() => setViewMode("list")}
            aria-label="List view"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "masonry" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-l-none"
            onClick={() => setViewMode("masonry")}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {activeFilterCount > 0 && !showFilters && (
        <div
          className="flex items-center flex-wrap gap-1.5 py-3 animate-fade-in"
        >
          {filters.statuses.map((s) => (
            <ActiveFilterPill
              key={s}
              label={STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
              onRemove={() => toggleStringFilter("statuses", s)}
            />
          ))}
          {filters.roles.map((r) => {
            const role = rolesList.find((rl) => rl.slug === r);
            return (
              <ActiveFilterPill
                key={r}
                label={role?.name || r}
                onRemove={() => toggleStringFilter("roles", r)}
              />
            );
          })}
          {filters.resourceTags.map((t) => {
            const res = resourcesList.find((rs) => rs.slug === t);
            return (
              <ActiveFilterPill
                key={t}
                label={res?.name || t}
                onRemove={() => toggleStringFilter("resourceTags", t)}
              />
            );
          })}
          {filters.categories.map((c) => {
            const cat = categoryList?.find((cl) => cl._id === c);
            return (
              <ActiveFilterPill
                key={c}
                label={c === "__none__" ? "No Category" : cat?.name || c}
                onRemove={() => toggleCategoryFilter(c)}
              />
            );
          })}
          {filters.needsTeammates && (
            <ActiveFilterPill
              label="Needs Teammates"
              onRemove={() =>
                setFilters((prev) => ({ ...prev, needsTeammates: false }))
              }
            />
          )}
          {filters.needsResources && (
            <ActiveFilterPill
              label="Needs Resources"
              onRemove={() =>
                setFilters((prev) => ({ ...prev, needsResources: false }))
              }
            />
          )}
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {showFilters && (
        <div className="py-5 border-t border-b mb-2 animate-fade-in space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Filters
            </span>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-2 font-medium">
              Status
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <FilterPill
                  key={s}
                  label={STATUS_LABELS[s]}
                  active={filters.statuses.includes(s)}
                  onClick={() => toggleStringFilter("statuses", s)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-2 font-medium">
              Missing Roles
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rolesList.map((r) => (
                <FilterPill
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
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-2 font-medium">
                Resource Needs
              </p>
              <div className="flex flex-wrap gap-1.5">
                {resourcesList.map((resource) => (
                  <FilterPill
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
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-2 font-medium">
                Category
              </p>
              <div className="flex flex-wrap gap-1.5">
                <FilterPill
                  label="No Category"
                  active={filters.categories.includes("__none__")}
                  onClick={() => toggleCategoryFilter("__none__")}
                />
                {categoryList.map((cat) => (
                  <FilterPill
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
            <FilterPill
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
            <FilterPill
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

      <div className="mt-4">
        {status === "LoadingFirstPage" ? (
          viewMode === "masonry" ? (
            <div className="columns-1 md:columns-2 lg:columns-3 gap-4">
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
            <div className="divide-y divide-border/40">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`animate-fade-in stagger-${i + 1}`}
                >
                  <IdeaExpandedRowSkeleton />
                </div>
              ))}
            </div>
          )
        ) : ideaResults.length === 0 ? (
          <div className="text-center py-24 animate-fade-in">
            <p className="text-lg font-medium mb-1.5">
              {activeFilterCount === 0 && !filters.search
                ? "No ideas yet"
                : "No matching ideas"}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {activeFilterCount === 0 && !filters.search
                ? "Be the first to share a concept for the hackathon."
                : "Try adjusting your search or filters."}
            </p>
            {activeFilterCount === 0 && !filters.search && (
              <Link href="/product/ideas/new">
                <Button variant="outline">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add the First Idea
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            {viewMode === "masonry" ? (
              <div className="columns-1 md:columns-2 lg:columns-3 gap-4">
                {ideaResults.map((idea, i) => (
                  <div
                    key={idea._id}
                    className={`animate-fade-in stagger-${Math.min(i + 1, 9)}`}
                  >
                    <IdeaMasonryItem idea={idea} href={ideaDetailHref(idea._id)} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {ideaResults.map((idea, i) => (
                  <div
                    key={idea._id}
                    className={`animate-fade-in stagger-${Math.min(i + 1, 9)}`}
                  >
                    <IdeaExpandedRow idea={idea} href={ideaDetailHref(idea._id)} />
                  </div>
                ))}
              </div>
            )}
            {status === "CanLoadMore" && (
              <div className="flex flex-col items-center gap-2 mt-10">
                <Button
                  variant="outline"
                  onClick={() => loadMore(PAGE_SIZE)}
                  className="min-w-[140px]"
                >
                  Load{" "}
                  {remainingIdeaCount === null
                    ? "more"
                    : `${Math.min(remainingIdeaCount, PAGE_SIZE)} more`}
                </Button>
                {ideaCount !== undefined && (
                  <p className="text-xs text-muted-foreground font-mono tabular-nums">
                    Showing {ideaResults.length} of {ideaCount}
                  </p>
                )}
              </div>
            )}
            {status === "LoadingMore" && (
              <div className="flex justify-center mt-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterPill({
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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
        active
          ? "bg-foreground text-background"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ActiveFilterPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/80 text-xs text-foreground font-medium">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
