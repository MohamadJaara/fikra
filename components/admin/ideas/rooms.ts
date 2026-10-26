import type { Id } from "@/convex/_generated/dataModel";
import type { TeamSize } from "@/lib/constants";
import type { RoomItem } from "@/lib/types";

export function teamSizeCapacity(teamSize: TeamSize) {
  if (teamSize === "solo") return 1;
  if (teamSize === "small") return 3;
  if (teamSize === "medium") return 6;
  return 7;
}

export function roomOccupancy(room: RoomItem) {
  if (room.type === "team") return `${room.assignedIdeaIds.length}/1`;
  if (room.assignmentLimit !== undefined) {
    return `${room.assignedIdeaIds.length}/${room.assignmentLimit}`;
  }
  return `${room.assignedIdeaIds.length} assigned`;
}

export function roomCapacityLabel(room: RoomItem) {
  if (room.type === "team") return "1 idea";
  if (room.assignmentLimit !== undefined)
    return `${room.assignmentLimit} ideas`;
  return "No limit";
}

export function roomIsAvailableForIdea(room: RoomItem, ideaId: Id<"ideas">) {
  if (room.type === "team") {
    return (
      room.assignedIdeaIds.length === 0 || room.assignedIdeaIds.includes(ideaId)
    );
  }

  if (room.type === "shared" && room.assignmentLimit !== undefined) {
    const assignedToOtherIdeas = room.assignedIdeaIds.filter(
      (assignedIdeaId) => assignedIdeaId !== ideaId,
    );
    return assignedToOtherIdeas.length < room.assignmentLimit;
  }

  return true;
}

export function parseSharedLimit(value: string, type: string) {
  if (type !== "shared") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return Number(trimmed);
}
