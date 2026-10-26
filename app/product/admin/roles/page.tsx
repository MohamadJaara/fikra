"use client";

import { useMutation, useQuery } from "convex/react";
import { Shield } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { NamedItemManager } from "@/components/admin/NamedItemManager";
import {
  useProductBase,
  useSelectedHackathon,
} from "@/components/ProductLayoutClient";

export default function AdminRolesPage() {
  const hackathon = useSelectedHackathon();
  const productBase = useProductBase();
  const items = useQuery(api.roles.list, { hackathonId: hackathon?._id });
  const createMany = useMutation(api.roles.createMany);
  const remove = useMutation(api.roles.remove);

  return (
    <NamedItemManager
      title="Roles"
      itemLabel="Role"
      icon={Shield}
      backHref={`${productBase}/admin`}
      inputPlaceholder="e.g. Frontend, Backend, Design, PM (comma-separated)"
      items={items}
      onCreate={(names) => createMany({ hackathonId: hackathon?._id, names })}
      onDelete={(roleId) => remove({ roleId })}
      getDeleteConfirmation={(name) =>
        `Delete "${name}"? Users and ideas with this role will have it removed.`
      }
    />
  );
}
