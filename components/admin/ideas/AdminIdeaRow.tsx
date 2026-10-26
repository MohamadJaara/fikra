"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  TEAM_SIZE_LABELS,
  type Status,
  type TeamSize,
} from "@/lib/constants";
import type { RoomItem } from "@/lib/types";
import { IdeaRoomAssignment } from "./IdeaRoomAssignment";
import type { AdminIdea } from "./types";

export function AdminIdeaRow({
  idea,
  rooms,
  productBase,
  roleLabels,
}: {
  idea: AdminIdea;
  rooms: RoomItem[];
  productBase: string;
  roleLabels: Record<string, string>;
}) {
  const deleteIdea = useMutation(api.admin.deleteIdea);
  const updateIdeaStatus = useMutation(api.admin.updateIdeaStatus);
  const updateIdeaOnsiteOnly = useMutation(api.admin.updateIdeaOnsiteOnly);
  const handleDeleteIdea = async (ideaId: Id<"ideas">, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteIdea({ ideaId });
      toast.success(`Deleted "${title}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  const handleStatusChange = async (ideaId: Id<"ideas">, status: Status) => {
    if (
      status === "shelved" &&
      !confirm(
        "Shelve this idea? The owner will be notified and can reopen it if they plan to keep working on it.",
      )
    ) {
      return;
    }

    try {
      await updateIdeaStatus({ ideaId, status });
      toast.success(
        status === "shelved"
          ? "Idea shelved and owner notified"
          : "Status updated",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
  };

  const handleOnsiteOnlyChange = async (
    ideaId: Id<"ideas">,
    onsiteOnly: boolean,
  ) => {
    try {
      await updateIdeaOnsiteOnly({ ideaId, onsiteOnly });
      toast.success(
        onsiteOnly ? "Set to on-site only" : "Removed on-site restriction",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
  };

  return (
    <TableRow>
      <TableCell>
        <Link
          href={`${productBase}/ideas/${idea._id}`}
          className="font-medium text-sm hover:underline"
        >
          {idea.title}
        </Link>
        <p className="text-xs text-muted-foreground">
          {new Date(idea._creationTime).toLocaleDateString()} ·{" "}
          {idea.commentCount} comments · {idea.reactionCount} reactions
        </p>
      </TableCell>
      <TableCell>
        <p className="text-sm">{idea.ownerName}</p>
        <p className="text-xs text-muted-foreground">{idea.ownerEmail}</p>
      </TableCell>
      <TableCell>
        <Select
          value={idea.status}
          onValueChange={(v) => handleStatusChange(idea._id, v as Status)}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                <Badge variant="outline" className={STATUS_COLORS[status]}>
                  {STATUS_LABELS[status]}
                </Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-sm">
        {idea.memberCount} · {TEAM_SIZE_LABELS[idea.teamSize as TeamSize]}
      </TableCell>
      <TableCell>
        <div className="flex max-w-[210px] flex-wrap gap-1">
          {idea.lookingForRoles.length === 0 ? (
            <span className="text-xs text-muted-foreground">None</span>
          ) : (
            idea.lookingForRoles.map((role: string) => (
              <Badge key={role} variant="secondary" className="text-xs">
                {roleLabels[role] || role}
              </Badge>
            ))
          )}
        </div>
      </TableCell>
      <IdeaRoomAssignment idea={idea} rooms={rooms} />
      <TableCell>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={idea.onsiteOnly ?? false}
            onChange={(e) => handleOnsiteOnlyChange(idea._id, e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-xs">
            {idea.onsiteOnly ? (
              <span className="flex items-center gap-1 text-blue-700 dark:text-blue-300">
                <MapPin className="h-3 w-3" />
                On-site
              </span>
            ) : (
              "Open"
            )}
          </span>
        </label>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleDeleteIdea(idea._id, idea.title)}
          className="h-8 gap-1 text-xs"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </TableCell>
    </TableRow>
  );
}
