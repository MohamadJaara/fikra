"use client";

import { DoorOpen, Link2, Loader2, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ROOM_TYPE_LABELS,
  TEAM_FORMATION_SOURCE_LABELS,
  type RoomType,
  type TeamFormationSource,
} from "@/lib/constants";
import type { RoomItem } from "@/lib/types";
import { roomIsAvailableForIdea, roomOccupancy } from "./rooms";
import { useRoomAllocation } from "./RoomAllocationProvider";
import type { AdminIdea } from "./types";

export function IdeaRoomAssignment({
  idea,
  rooms,
}: {
  idea: AdminIdea;
  rooms: RoomItem[];
}) {
  const {
    selectedRoomByIdea,
    setSelectedRoomByIdea,
    assigningIdeaId,
    unassigningIdeaId,
    markingRoomIdeaId,
    handleAssignRoom,
    handleUnassignRoom,
    handleMarkNeedsRoom,
  } = useRoomAllocation();
  const selectedRoomId = selectedRoomByIdea[idea._id];
  const selectedRoom = rooms.find((room) => room._id === selectedRoomId);
  const selectedRoomIsAvailable =
    selectedRoom && roomIsAvailableForIdea(selectedRoom, idea._id);
  const isAssigningThisIdea = assigningIdeaId === idea._id;
  return (
    <TableCell>
      {idea.roomName ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          >
            <DoorOpen className="h-3 w-3" />
            {idea.roomName}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={unassigningIdeaId === idea._id}
            onClick={() => void handleUnassignRoom(idea._id)}
          >
            {unassigningIdeaId === idea._id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Unlink className="h-3.5 w-3.5" />
            )}
            Unassign
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {idea.roomRequestStatus === "requested" ? (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
              >
                Needs room
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => void handleMarkNeedsRoom(idea._id)}
                disabled={markingRoomIdeaId === idea._id}
              >
                {markingRoomIdeaId === idea._id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <DoorOpen className="h-3 w-3" />
                )}
                Need room
              </Button>
            )}
            {idea.teamFormationSource && (
              <span className="text-xs text-muted-foreground">
                {TEAM_FORMATION_SOURCE_LABELS[
                  idea.teamFormationSource as TeamFormationSource
                ] || idea.teamFormationSource}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Select
              value={selectedRoomId ?? ""}
              onValueChange={(roomId) =>
                setSelectedRoomByIdea((current) => ({
                  ...current,
                  [idea._id]: roomId as Id<"rooms">,
                }))
              }
              disabled={isAssigningThisIdea}
            >
              <SelectTrigger className="h-8 min-w-0 flex-1 text-xs">
                <SelectValue placeholder="Choose room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => {
                  const disabled = !roomIsAvailableForIdea(room, idea._id);

                  return (
                    <SelectItem
                      key={room._id}
                      value={room._id}
                      disabled={disabled}
                    >
                      {room.name} ·{" "}
                      {ROOM_TYPE_LABELS[room.type as RoomType] || room.type} (
                      {roomOccupancy(room)}
                      {room.type === "shared" &&
                      room.assignmentLimit === undefined
                        ? ", no limit"
                        : ""}
                      )
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 shrink-0 gap-1.5 text-xs"
              onClick={() => void handleAssignRoom(idea._id)}
              disabled={!selectedRoomIsAvailable || isAssigningThisIdea}
            >
              {isAssigningThisIdea ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              Assign
            </Button>
          </div>
        </div>
      )}
    </TableCell>
  );
}
