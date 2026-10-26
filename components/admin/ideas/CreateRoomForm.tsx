"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROOM_TYPES, ROOM_TYPE_LABELS } from "@/lib/constants";
import { parseSharedLimit } from "./rooms";

export function CreateRoomForm({
  hackathonId,
}: {
  hackathonId?: Id<"hackathons">;
}) {
  const createRoom = useMutation(api.rooms.create);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("team");
  const [assignmentLimit, setAssignmentLimit] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await createRoom({
        ...(hackathonId ? { hackathonId } : {}),
        name,
        type,
        assignmentLimit: parseSharedLimit(assignmentLimit, type),
      });
      toast.success(`Room "${name}" created`);
      setName("");
      setAssignmentLimit("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create room",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={handleCreateRoom} className="space-y-3 border p-4">
      <div>
        <h2 className="text-sm font-semibold">Room Inventory</h2>
        <p className="text-xs text-muted-foreground">
          Add team rooms, shared rooms, and optional shared limits.
        </p>
      </div>
      <Input
        placeholder="Room name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROOM_TYPES.map((roomType) => (
              <SelectItem key={roomType} value={roomType}>
                {ROOM_TYPE_LABELS[roomType]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={1}
          max={999}
          step={1}
          placeholder={type === "shared" ? "Limit" : "Team room"}
          value={assignmentLimit}
          onChange={(e) => setAssignmentLimit(e.target.value)}
          disabled={type !== "shared"}
        />
      </div>
      <Button
        type="submit"
        className="w-full gap-2"
        disabled={isCreating || !name.trim()}
      >
        {isCreating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <PlusCircle className="h-4 w-4" />
        )}
        Add Room
      </Button>
    </form>
  );
}
