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

export function useResourcesMap() {
  const resources = useQuery(api.resources.list);
  return useMemo(() => {
    if (!resources) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    for (const resource of resources) {
      map[resource.slug] = resource.name;
    }
    return map;
  }, [resources]);
}

export function useResourcesList() {
  const resources = useQuery(api.resources.list);
  return useMemo(() => {
    if (!resources) return [] as { slug: string; name: string }[];
    return resources.map((resource) => ({
      slug: resource.slug,
      name: resource.name,
    }));
  }, [resources]);
}
