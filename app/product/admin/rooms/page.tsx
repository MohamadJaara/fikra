"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  PlusCircle,
  Trash2,
  Loader2,
  DoorOpen,
  Link2,
  Unlink,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { ROOM_TYPES, ROOM_TYPE_LABELS } from "@/lib/constants";
import type { RoomType } from "@/lib/constants";

export default function AdminRoomsPage() {
  const rooms = useQuery(api.rooms.list);
  const ideas = useQuery(api.admin.listIdeas);
  const createMutation = useMutation(api.rooms.create);
  const deleteMutation = useMutation(api.rooms.remove);
  const assignMutation = useMutation(api.rooms.assignToIdea);
  const unassignMutation = useMutation(api.rooms.unassignFromIdea);

  const [name, setName] = useState("");
  const [type, setType] = useState<string>("team");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"rooms"> | null>(null);
  const [assignDialogRoomId, setAssignDialogRoomId] =
    useState<Id<"rooms"> | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<Id<"ideas"> | null>(
    null,
  );
  const [isAssigning, setIsAssigning] = useState(false);
  const [unassigningIdeaId, setUnassigningIdeaId] =
    useState<Id<"ideas"> | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await createMutation({ name, type });
      toast.success(`Room "${name}" created`);
      setName("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create room",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: Id<"rooms">, roomName: string) => {
    if (
      !confirm(
        `Delete room "${roomName}"? It will be unassigned from all ideas.`,
      )
    )
      return;
    setDeletingId(id);
    try {
      await deleteMutation({ roomId: id });
      toast.success("Room deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAssign = async () => {
    if (!assignDialogRoomId || !selectedIdeaId) return;
    setIsAssigning(true);
    try {
      await assignMutation({
        roomId: assignDialogRoomId,
        ideaId: selectedIdeaId,
      });
      toast.success("Room assigned to idea");
      setAssignDialogRoomId(null);
      setSelectedIdeaId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async (ideaId: Id<"ideas">) => {
    setUnassigningIdeaId(ideaId);
    try {
      await unassignMutation({ ideaId });
      toast.success("Room unassigned");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unassign",
      );
    } finally {
      setUnassigningIdeaId(null);
    }
  };

  const unassignedIdeas = ideas?.filter((idea: any) => !idea.roomId) ?? [];
  const selectedRoom = rooms?.find((r) => r._id === assignDialogRoomId);

  if (rooms === undefined || ideas === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading rooms...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/product/admin"
          className="text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DoorOpen className="h-6 w-6" />
            Rooms
          </h1>
          <p className="text-sm text-muted-foreground">
            {rooms.length} rooms · manage rooms and assign them to ideas
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          placeholder="Room name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 max-w-xs"
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROOM_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {ROOM_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={isCreating || !name.trim()}>
          {isCreating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <PlusCircle className="h-4 w-4 mr-2" />
          )}
          Add Room
        </Button>
      </form>

      {rooms.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No rooms yet. Add one above.
        </div>
      ) : (
        <div className="space-y-4">
          {rooms.map((room) => {
            const isTeamRoomFull =
              room.type === "team" && room.assignedIdeaIds.length > 0;

            return (
            <div key={room._id} className="border rounded-lg overflow-hidden">
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{room.name}</span>
                    <Badge
                      variant={room.type === "shared" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {ROOM_TYPE_LABELS[room.type as RoomType] || room.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog
                      open={assignDialogRoomId === room._id}
                      onOpenChange={(open) => {
                        if (!open) {
                          setAssignDialogRoomId(null);
                          setSelectedIdeaId(null);
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAssignDialogRoomId(room._id)}
                          disabled={unassignedIdeas.length === 0 || isTeamRoomFull}
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          Assign Idea
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            Assign idea to &ldquo;{room.name}&rdquo;
                          </DialogTitle>
                          <DialogDescription>
                            {selectedRoom?.type === "team"
                              ? "Team rooms can only be assigned to one idea."
                              : "Shared rooms can be assigned to multiple ideas. Select an idea that doesn&apos;t already have a room assigned."}
                          </DialogDescription>
                        </DialogHeader>
                        {isTeamRoomFull ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            This team room is already assigned. Unassign it first
                            to use it with another idea.
                          </p>
                        ) : unassignedIdeas.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            All ideas already have rooms assigned.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-auto">
                            {unassignedIdeas.map((idea: any) => (
                              <button
                                key={idea._id}
                                type="button"
                                onClick={() => setSelectedIdeaId(idea._id)}
                                className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                                  selectedIdeaId === idea._id
                                    ? "border-primary bg-primary/5"
                                    : "hover:bg-muted/50"
                                }`}
                              >
                                <span className="font-medium">
                                  {idea.title}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  by {idea.ownerName}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setAssignDialogRoomId(null);
                              setSelectedIdeaId(null);
                            }}
                            disabled={isAssigning}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleAssign}
                            disabled={!selectedIdeaId || isAssigning}
                          >
                            {isAssigning ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Link2 className="h-4 w-4 mr-1" />
                            )}
                            Assign
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive"
                      disabled={deletingId === room._id}
                      onClick={() => handleDelete(room._id, room.name)}
                    >
                      {deletingId === room._id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 mr-1" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>

                {room.assignedIdeaIds.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">
                      Assigned ideas ({room.assignedIdeaIds.length}):
                    </p>
                    <div className="space-y-1">
                      {room.assignedIdeaIds.map((ideaId, idx) => (
                        <div
                          key={ideaId}
                          className="flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm"
                        >
                          <Link
                            href={`/product/ideas/${ideaId}`}
                            className="font-medium hover:underline"
                          >
                            {room.assignedIdeaTitles[idx]}
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground"
                            disabled={unassigningIdeaId === ideaId}
                            onClick={() => handleUnassign(ideaId)}
                          >
                            {unassigningIdeaId === ideaId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Unlink className="h-3 w-3 mr-1" />
                            )}
                            Unassign
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      <Toaster />
    </div>
  );
}
