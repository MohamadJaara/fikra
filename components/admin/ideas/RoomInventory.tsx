"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Trash2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROOM_TYPE_LABELS, type RoomType } from "@/lib/constants";
import type { RoomItem } from "@/lib/types";
import { CreateRoomForm } from "./CreateRoomForm";
import { EditRoomDialog } from "./EditRoomDialog";
import { useRoomAllocation } from "./RoomAllocationProvider";
import { roomCapacityLabel, roomOccupancy } from "./rooms";

export function RoomInventory({
  rooms,
  hackathonId,
  productBase,
  openTeamRoomCount,
  waitingIdeaCount,
}: {
  rooms: RoomItem[];
  hackathonId?: Id<"hackathons">;
  productBase: string;
  openTeamRoomCount: number;
  waitingIdeaCount: number;
}) {
  const deleteRoom = useMutation(api.rooms.remove);
  const [deletingRoomId, setDeletingRoomId] = useState<Id<"rooms"> | null>(
    null,
  );
  const { unassigningIdeaId, handleUnassignRoom } = useRoomAllocation();
  const handleDeleteRoom = async (id: Id<"rooms">, roomName: string) => {
    if (
      !confirm(
        `Delete room "${roomName}"? It will be unassigned from all ideas.`,
      )
    )
      return;
    setDeletingRoomId(id);
    try {
      await deleteRoom({ roomId: id });
      toast.success("Room deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeletingRoomId(null);
    }
  };

  return (
    <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
      <CreateRoomForm hackathonId={hackathonId} />

      <div className="overflow-hidden border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Rooms</h2>
            <p className="text-xs text-muted-foreground">
              {rooms.length} total · {openTeamRoomCount} team open
            </p>
          </div>
          {waitingIdeaCount === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <Badge>{waitingIdeaCount} waiting</Badge>
          )}
        </div>

        {rooms.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No rooms yet.
          </div>
        ) : (
          <div className="max-h-[640px] divide-y overflow-auto">
            {rooms.map((room) => {
              const hasLocationInfo =
                room.address || room.directions || room.mapsLink;
              const isFull =
                room.type === "team"
                  ? room.assignedIdeaIds.length > 0
                  : room.assignmentLimit !== undefined &&
                    room.assignedIdeaIds.length >= room.assignmentLimit;

              return (
                <div key={room._id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {room.name}
                        </span>
                        <Badge
                          variant={
                            room.type === "shared" ? "default" : "secondary"
                          }
                          className="shrink-0 text-[10px]"
                        >
                          {ROOM_TYPE_LABELS[room.type as RoomType] || room.type}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {roomOccupancy(room)} · {roomCapacityLabel(room)}
                        {isFull ? " · full" : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <EditRoomDialog room={room} />

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        title="Delete room"
                        disabled={deletingRoomId === room._id}
                        onClick={() =>
                          void handleDeleteRoom(room._id, room.name)
                        }
                      >
                        {deletingRoomId === room._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {hasLocationInfo && (
                    <div className="mt-2 space-y-1 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      {room.address && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 shrink-0 opacity-60" />
                          <span>{room.address}</span>
                        </div>
                      )}
                      {room.directions && (
                        <div className="flex items-start gap-1.5">
                          <Navigation className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
                          <span className="leading-relaxed">
                            {room.directions}
                          </span>
                        </div>
                      )}
                      {room.mapsLink && (
                        <a
                          href={room.mapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open in Maps
                        </a>
                      )}
                    </div>
                  )}

                  {room.assignedIdeaIds.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {room.assignedIdeaIds.map((ideaId, idx) => (
                        <div
                          key={ideaId}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <Link
                            href={`${productBase}/ideas/${ideaId}`}
                            className="truncate text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {room.assignedIdeaTitles[idx]}
                          </Link>
                          <button
                            type="button"
                            className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                            disabled={unassigningIdeaId === ideaId}
                            onClick={() => void handleUnassignRoom(ideaId)}
                          >
                            {unassigningIdeaId === ideaId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Unlink className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
