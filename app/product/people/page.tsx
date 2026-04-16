"use client";

import { api } from "@/convex/_generated/api";
import { useRolesList, useRolesMap } from "@/lib/hooks";
import type { PublicUser } from "@/lib/types";
import { usePaginatedQuery } from "convex/react";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Search, Users, Loader2 } from "lucide-react";

const PAGE_SIZE = 50;

export default function PeoplePage() {
  const {
    results: users,
    status,
    loadMore,
  } = usePaginatedQuery(api.users.listAll, {}, { initialNumItems: PAGE_SIZE });
  const roles = useRolesList();
  const roleLabels = useRolesMap();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const hasActiveFilters = search.trim().length > 0 || roleFilter.length > 0;

  const filtered = useMemo(() => {
    if (!users) return [];
    return users.filter((u: PublicUser) => {
      if (search) {
        const q = search.toLowerCase();
        const name = (u.name || "").toLowerCase();
        const handle = (u.handle || "").toLowerCase();
        if (!name.includes(q) && !handle.includes(q)) return false;
      }
      if (roleFilter.length > 0) {
        const userRoles = u.roles || [];
        if (!roleFilter.some((r) => userRoles.includes(r))) return false;
      }
      return true;
    });
  }, [users, search, roleFilter]);

  const toggleRole = (role: string) => {
    setRoleFilter((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Link
        href="/product"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Browse
      </Link>

      <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
        <Users className="h-5 w-5" />
        People
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {status === "LoadingFirstPage"
          ? "Loading..."
          : `${users.length} people${status !== "Exhausted" ? "+" : ""}`}
      </p>

      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or handle..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {roles.map((role) => (
            <Badge
              key={role.slug}
              variant={roleFilter.includes(role.slug) ? "default" : "outline"}
              className="cursor-pointer select-none text-xs px-2 py-1"
              onClick={() => toggleRole(role.slug)}
            >
              {role.name}
            </Badge>
          ))}
          {roleFilter.length > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-primary px-2 py-1"
              onClick={() => setRoleFilter([])}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {status === "LoadingFirstPage" ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <>
          <div className="text-center py-12 text-muted-foreground">
            {hasActiveFilters && status === "CanLoadMore"
              ? "No matches in loaded people yet"
              : "No people found"}
          </div>
          <PeoplePagination status={status} loadMore={loadMore} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((user: PublicUser) => (
              <Link
                key={user._id}
                href={`/product/profile/${user.handle}`}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={user.image} />
                  <AvatarFallback className="text-sm">
                    {(user.name || user.firstName || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {user.name || "Unknown"}
                  </p>
                  {user.handle && (
                    <p className="text-xs text-muted-foreground">
                      @{user.handle}
                    </p>
                  )}
                  {user.roles && user.roles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.roles.slice(0, 3).map((r) => (
                        <Badge
                          key={r}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {roleLabels[r] || r}
                        </Badge>
                      ))}
                      {user.roles.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{user.roles.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <PeoplePagination status={status} loadMore={loadMore} />
        </>
      )}
    </div>
  );
}

function PeoplePagination({
  status,
  loadMore,
}: {
  status: string;
  loadMore: (numItems: number) => void;
}) {
  if (status === "CanLoadMore") {
    return (
      <div className="flex justify-center mt-6">
        <Button variant="outline" onClick={() => loadMore(PAGE_SIZE)}>
          Load more
        </Button>
      </div>
    );
  }

  if (status === "LoadingMore") {
    return (
      <div className="flex justify-center mt-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return null;
}
