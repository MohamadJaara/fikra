"use client";

import { createContext, use, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// The idea table and room inventory share selections and in-flight allocation actions.
function useRoomAllocationState(hackathonId?: Id<"hackathons">) {
  const hackathonArgs = hackathonId ? { hackathonId } : {};
  const markIdeaNeedsRoom = useMutation(api.rooms.markIdeaNeedsRoom);
  const assignRoom = useMutation(api.rooms.assignToIdea);
  const unassignRoom = useMutation(api.rooms.unassignFromIdea);
  const queueFullIdeas = useMutation(api.rooms.queueFullIdeasForRooms);
  const [markingRoomIdeaId, setMarkingRoomIdeaId] =
    useState<Id<"ideas"> | null>(null);
  const [selectedRoomByIdea, setSelectedRoomByIdea] = useState<
    Record<string, Id<"rooms">>
  >({});
  const [assigningIdeaId, setAssigningIdeaId] = useState<Id<"ideas"> | null>(
    null,
  );
  const [unassigningIdeaId, setUnassigningIdeaId] =
    useState<Id<"ideas"> | null>(null);
  const [isCheckingFullIdeas, setIsCheckingFullIdeas] = useState(false);

  const handleMarkNeedsRoom = async (ideaId: Id<"ideas">) => {
    setMarkingRoomIdeaId(ideaId);
    try {
      await markIdeaNeedsRoom({ ideaId });
      toast.success("Idea added to the room queue");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to request room",
      );
    } finally {
      setMarkingRoomIdeaId(null);
    }
  };

  const handleAssignRoom = async (ideaId: Id<"ideas">) => {
    const roomId = selectedRoomByIdea[ideaId];
    if (!roomId) return;

    setAssigningIdeaId(ideaId);
    try {
      await assignRoom({ roomId, ideaId });
      toast.success("Room assigned to idea");
      setSelectedRoomByIdea((current) => {
        const next = { ...current };
        delete next[ideaId];
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign");
    } finally {
      setAssigningIdeaId(null);
    }
  };

  const handleUnassignRoom = async (ideaId: Id<"ideas">) => {
    setUnassigningIdeaId(ideaId);
    try {
      await unassignRoom({ ideaId });
      toast.success("Room unassigned");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unassign",
      );
    } finally {
      setUnassigningIdeaId(null);
    }
  };

  const handleCheckFullIdeas = async () => {
    setIsCheckingFullIdeas(true);
    try {
      const result = await queueFullIdeas(hackathonArgs);
      toast.success(
        result.queuedCount === 0
          ? `Checked ${result.checkedCount} ready teams. Nothing new to queue.`
          : `Queued ${result.queuedCount} ready team${result.queuedCount === 1 ? "" : "s"} for rooms.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to check ready teams",
      );
    } finally {
      setIsCheckingFullIdeas(false);
    }
  };

  return {
    markingRoomIdeaId,
    selectedRoomByIdea,
    setSelectedRoomByIdea,
    assigningIdeaId,
    unassigningIdeaId,
    isCheckingFullIdeas,
    handleMarkNeedsRoom,
    handleAssignRoom,
    handleUnassignRoom,
    handleCheckFullIdeas,
  };
}

const RoomAllocationContext = createContext<ReturnType<
  typeof useRoomAllocationState
> | null>(null);

export function RoomAllocationProvider({
  hackathonId,
  children,
}: {
  hackathonId?: Id<"hackathons">;
  children: ReactNode;
}) {
  const allocation = useRoomAllocationState(hackathonId);
  return (
    <RoomAllocationContext value={allocation}>
      {children}
    </RoomAllocationContext>
  );
}

export function useRoomAllocation() {
  const allocation = use(RoomAllocationContext);
  if (!allocation)
    throw new Error("useRoomAllocation requires RoomAllocationProvider");
  return allocation;
}
