"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";
import { useSelectedHackathon } from "@/components/ProductLayoutClient";

export type RoleOption = { slug: string; name: string };

export function useRoles() {
  const hackathon = useSelectedHackathon();
  const result = useQuery(api.roles.list, {
    hackathonId: hackathon?._id,
  });
  return useMemo(() => {
    const roles: RoleOption[] = [];
    const roleLabels: Record<string, string> = {};
    for (const role of result ?? []) {
      roles.push({ slug: role.slug, name: role.name });
      roleLabels[role.slug] = role.name;
    }
    return { roles, roleLabels, isLoading: result === undefined };
  }, [result]);
}

// Compatibility helpers for display-only consumers. Pickers should use useRoles
// so they can distinguish loading from an event with no configured roles.
export function useRolesMap() {
  return useRoles().roleLabels;
}

export function useRolesList() {
  return useRoles().roles;
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
