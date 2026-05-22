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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  PlusCircle,
  Trash2,
  Loader2,
  DoorOpen,
  Link2,
  Unlink,
  Pencil,
  MapPin,
  Navigation,
  ExternalLink,
  ClipboardList,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ROOM_REQUEST_LABELS,
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
  TEAM_FORMATION_SOURCE_LABELS,
} from "@/lib/constants";
import type {
  RoomRequestStatus,
  RoomType,
  TeamSize,
  TeamFormationSource,
} from "@/lib/constants";
import type { RoomItem } from "@/lib/types";

function teamSizeCapacity(teamSize: TeamSize) {
  if (teamSize === "solo") return 1;
  if (teamSize === "small") return 3;
  if (teamSize === "medium") return 6;
  return 7;
}

export default function AdminRoomsPage() {
  const rooms = useQuery(api.rooms.list);
  const ideas = useQuery(api.admin.listIdeas);
  const createMutation = useMutation(api.rooms.create);
  const deleteMutation = useMutation(api.rooms.remove);
  const updateMutation = useMutation(api.rooms.update);
  const assignMutation = useMutation(api.rooms.assignToIdea);
  const unassignMutation = useMutation(api.rooms.unassignFromIdea);
  const queueFullIdeasMutation = useMutation(api.rooms.queueFullIdeasForRooms);

  const [name, setName] = useState("");
  const [type, setType] = useState<string>("team");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"rooms"> | null>(null);
  const [editRoomId, setEditRoomId] = useState<Id<"rooms"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<string>("team");
  const [editAddress, setEditAddress] = useState("");
  const [editDirections, setEditDirections] = useState("");
  const [editMapsLink, setEditMapsLink] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedRoomByIdea, setSelectedRoomByIdea] = useState<
    Record<string, Id<"rooms">>
  >({});
  const [assigningIdeaId, setAssigningIdeaId] = useState<Id<"ideas"> | null>(
    null,
  );
  const [unassigningIdeaId, setUnassigningIdeaId] =
    useState<Id<"ideas"> | null>(null);
  const [isCheckingFullIdeas, setIsCheckingFullIdeas] = useState(false);

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

  const openEditDialog = (room: RoomItem) => {
    setEditRoomId(room._id);
    setEditName(room.name);
    setEditType(room.type);
    setEditAddress(room.address ?? "");
    setEditDirections(room.directions ?? "");
    setEditMapsLink(room.mapsLink ?? "");
  };

  const handleUpdate = async () => {
    if (!editRoomId || !editName.trim()) return;
    setIsUpdating(true);
    try {
      await updateMutation({
        roomId: editRoomId,
        name: editName,
        type: editType,
        address: editAddress || undefined,
        directions: editDirections || undefined,
        mapsLink: editMapsLink || undefined,
      });
      toast.success("Room updated");
      setEditRoomId(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update room",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssign = async (ideaId: Id<"ideas">) => {
    const roomId = selectedRoomByIdea[ideaId];
    if (!roomId) return;

    setAssigningIdeaId(ideaId);
    try {
      await assignMutation({
        roomId,
        ideaId,
      });
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

  const handleCheckFullIdeas = async () => {
    setIsCheckingFullIdeas(true);
    try {
      const result = await queueFullIdeasMutation({});
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

  const unassignedIdeas = ideas?.filter((idea) => !idea.roomId) ?? [];
  const roomRequests = unassignedIdeas.filter(
    (idea) => idea.roomRequestStatus === "requested",
  );
  const otherUnassignedIdeas = unassignedIdeas.filter(
    (idea) => idea.roomRequestStatus !== "requested",
  );
  const readyTeamsMissingRoom = otherUnassignedIdeas.filter(
    (idea) =>
      idea.status === "full" ||
      idea.memberCount >= teamSizeCapacity(idea.teamSize as TeamSize),
  );
  const roomList = rooms ?? [];
  const hasAvailableRoom = roomList.some(
    (room) => room.type === "shared" || room.assignedIdeaIds.length === 0,
  );

  if (rooms === undefined || ideas === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading rooms...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
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
            {rooms.length} rooms · {roomRequests.length} team
            {roomRequests.length === 1 ? "" : "s"} waiting
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/15">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Teams needing rooms</h2>
              <p className="text-xs text-muted-foreground">
                Auto-detected, owner-marked, or full teams ready for a room.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => void handleCheckFullIdeas()}
              disabled={isCheckingFullIdeas}
            >
              {isCheckingFullIdeas ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Check ready teams
            </Button>
            <Badge variant={roomRequests.length > 0 ? "default" : "secondary"}>
              {roomRequests.length}
            </Badge>
          </div>
        </div>

        {readyTeamsMissingRoom.length > 0 && (
          <div className="border-b bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            {readyTeamsMissingRoom.length} ready-looking team
            {readyTeamsMissingRoom.length === 1 ? "" : "s"} without room
            requests. Run the check to queue teams that reached capacity or
            filled their roles.
          </div>
        )}

        {roomRequests.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            No room requests waiting.
          </div>
        ) : (
          <div className="divide-y">
            {roomRequests.map((idea) => {
              const selectedRoomId = selectedRoomByIdea[idea._id];
              const selectedRoom = rooms.find(
                (room) => room._id === selectedRoomId,
              );
              const selectedRoomIsAvailable =
                selectedRoom &&
                (selectedRoom.type === "shared" ||
                  selectedRoom.assignedIdeaIds.length === 0);
              const isAssigningThisIdea = assigningIdeaId === idea._id;

              return (
                <div
                  key={idea._id}
                  className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/product/ideas/${idea._id}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {idea.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{idea.memberCount} members</span>
                      <span>·</span>
                      <span>by {idea.ownerName}</span>
                      {idea.teamFormationSource && (
                        <>
                          <span>·</span>
                          <span>
                            {TEAM_FORMATION_SOURCE_LABELS[
                              idea.teamFormationSource as TeamFormationSource
                            ] || idea.teamFormationSource}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto md:items-center">
                    <Badge
                      variant="outline"
                      className="w-fit shrink-0 text-[10px]"
                    >
                      {ROOM_REQUEST_LABELS[
                        idea.roomRequestStatus as RoomRequestStatus
                      ] || "Needs Room"}
                    </Badge>
                    <div className="flex w-full gap-2 md:w-[330px]">
                      <Select
                        value={selectedRoomId ?? ""}
                        onValueChange={(roomId) =>
                          setSelectedRoomByIdea((current) => ({
                            ...current,
                            [idea._id]: roomId as Id<"rooms">,
                          }))
                        }
                        disabled={!hasAvailableRoom || isAssigningThisIdea}
                      >
                        <SelectTrigger className="h-8 min-w-0 flex-1 text-xs">
                          <SelectValue
                            placeholder={
                              hasAvailableRoom ? "Choose room" : "No rooms open"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {rooms.map((room) => {
                            const isTeamRoomFull =
                              room.type === "team" &&
                              room.assignedIdeaIds.length > 0;

                            return (
                              <SelectItem
                                key={room._id}
                                value={room._id}
                                disabled={isTeamRoomFull}
                              >
                                {room.name}
                                {room.type === "shared"
                                  ? ` · Shared (${room.assignedIdeaIds.length})`
                                  : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-8 shrink-0 gap-1.5 text-xs"
                        onClick={() => void handleAssign(idea._id)}
                        disabled={
                          !selectedRoomIsAvailable || isAssigningThisIdea
                        }
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          placeholder="Room name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
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
        <div className="border rounded-lg overflow-hidden">
          <div className="divide-y">
            {rooms.map((room) => {
              const hasLocationInfo =
                room.address || room.directions || room.mapsLink;
              const hasDetails =
                hasLocationInfo || room.assignedIdeaIds.length > 0;

              return (
                <div key={room._id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate">
                        {room.name}
                      </span>
                      <Badge
                        variant={
                          room.type === "shared" ? "default" : "secondary"
                        }
                        className="text-[10px] shrink-0"
                      >
                        {ROOM_TYPE_LABELS[room.type as RoomType] || room.type}
                      </Badge>
                      {room.assignedIdeaIds.length > 0 && (
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {room.assignedIdeaIds.length}{" "}
                          {room.assignedIdeaIds.length === 1 ? "idea" : "ideas"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Dialog
                        open={editRoomId === room._id}
                        onOpenChange={(open) => {
                          if (!open) setEditRoomId(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openEditDialog(room)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Room</DialogTitle>
                            <DialogDescription>
                              Update room name, type, and location details.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Label className="text-xs">Name</Label>
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                />
                              </div>
                              <div className="w-[140px]">
                                <Label className="text-xs">Type</Label>
                                <Select
                                  value={editType}
                                  onValueChange={setEditType}
                                >
                                  <SelectTrigger>
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
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">Address</Label>
                              <Input
                                placeholder="Building, floor, room number..."
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Directions</Label>
                              <Textarea
                                placeholder="How to find the room..."
                                value={editDirections}
                                onChange={(e) =>
                                  setEditDirections(e.target.value)
                                }
                                rows={3}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Maps Link</Label>
                              <Input
                                placeholder="https://maps.google.com/..."
                                value={editMapsLink}
                                onChange={(e) =>
                                  setEditMapsLink(e.target.value)
                                }
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setEditRoomId(null)}
                              disabled={isUpdating}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleUpdate}
                              disabled={isUpdating || !editName.trim()}
                            >
                              {isUpdating && (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              )}
                              Save
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === room._id}
                        onClick={() => handleDelete(room._id, room.name)}
                      >
                        {deletingId === room._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {hasDetails && (
                    <div className="mt-2.5 pl-0 space-y-2">
                      {hasLocationInfo && (
                        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
                          {room.address && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 shrink-0 opacity-60" />
                              <span>{room.address}</span>
                            </div>
                          )}
                          {room.directions && (
                            <div className="flex items-start gap-1.5">
                              <Navigation className="h-3 w-3 mt-0.5 shrink-0 opacity-60" />
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
                              className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open in Maps
                            </a>
                          )}
                        </div>
                      )}

                      {room.assignedIdeaIds.length > 0 && (
                        <div className="space-y-0.5">
                          {room.assignedIdeaIds.map((ideaId, idx) => (
                            <div
                              key={ideaId}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <Link
                                href={`/product/ideas/${ideaId}`}
                                className="text-muted-foreground hover:text-foreground hover:underline truncate"
                              >
                                {room.assignedIdeaTitles[idx]}
                              </Link>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 disabled:opacity-50"
                                disabled={unassigningIdeaId === ideaId}
                                onClick={() => handleUnassign(ideaId)}
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
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Toaster />
    </div>
  );
}
