"use client";

import { useMutation, useQuery } from "convex/react";
import { Package } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { NamedItemManager } from "@/components/admin/NamedItemManager";
import {
  useProductBase,
  useSelectedHackathon,
} from "@/components/ProductLayoutClient";

export default function AdminResourcesPage() {
  const hackathon = useSelectedHackathon();
  const productBase = useProductBase();
  const items = useQuery(api.resources.list, { hackathonId: hackathon?._id });
  const createMany = useMutation(api.resources.createMany);
  const remove = useMutation(api.resources.remove);

  return (
    <NamedItemManager
      title="Resources"
      itemLabel="Resource"
      icon={Package}
      backHref={`${productBase}/admin`}
      inputPlaceholder="e.g. Linux VPS, Design Help, Mentoring (comma-separated)"
      items={items}
      onCreate={(names) => createMany({ hackathonId: hackathon?._id, names })}
      onDelete={(resourceId) => remove({ resourceId })}
      getDeleteConfirmation={(name) =>
        `Delete "${name}"? Existing requests will keep their label.`
      }
    />
  );
}
