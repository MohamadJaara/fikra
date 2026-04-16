"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";

export function useRolesMap() {
  const roles = useQuery(api.roles.list);
  return useMemo(() => {
    if (!roles) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    for (const r of roles) {
      map[r.slug] = r.name;
    }
    return map;
  }, [roles]);
}

export function useRolesList() {
  const roles = useQuery(api.roles.list);
  return useMemo(() => {
    if (!roles) return [] as { slug: string; name: string }[];
    return roles.map((r) => ({ slug: r.slug, name: r.name }));
  }, [roles]);
}
