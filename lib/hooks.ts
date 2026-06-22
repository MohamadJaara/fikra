"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";
import { useSelectedHackathon } from "@/components/ProductLayoutClient";

export function useRolesMap() {
  const hackathon = useSelectedHackathon();
  const roles = useQuery(api.roles.list, {
    hackathonId: hackathon?._id,
  });
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
  const hackathon = useSelectedHackathon();
  const roles = useQuery(api.roles.list, {
    hackathonId: hackathon?._id,
  });
  return useMemo(() => {
    if (!roles) return [] as { slug: string; name: string }[];
    return roles.map((r) => ({ slug: r.slug, name: r.name }));
  }, [roles]);
}

export function useResourcesMap() {
  const hackathon = useSelectedHackathon();
  const resources = useQuery(api.resources.list, {
    hackathonId: hackathon?._id,
  });
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
  const hackathon = useSelectedHackathon();
  const resources = useQuery(api.resources.list, {
    hackathonId: hackathon?._id,
  });
  return useMemo(() => {
    if (!resources) return [] as { slug: string; name: string }[];
    return resources.map((resource) => ({
      slug: resource.slug,
      name: resource.name,
    }));
  }, [resources]);
}
