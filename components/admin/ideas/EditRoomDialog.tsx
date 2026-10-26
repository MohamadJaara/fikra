"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ROOM_TYPES, ROOM_TYPE_LABELS } from "@/lib/constants";
import type { RoomItem } from "@/lib/types";
import { parseSharedLimit } from "./rooms";

export function EditRoomDialog({ room }: { room: RoomItem }) {
  const updateRoom = useMutation(api.rooms.update);
  const [open, setOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<string>("team");
  const [editAssignmentLimit, setEditAssignmentLimit] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDirections, setEditDirections] = useState("");
  const [editMapsLink, setEditMapsLink] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const openEditDialog = () => {
    setOpen(true);
    setEditName(room.name);
    setEditType(room.type);
    setEditAssignmentLimit(
      room.assignmentLimit === undefined ? "" : String(room.assignmentLimit),
    );
    setEditAddress(room.address ?? "");
    setEditDirections(room.directions ?? "");
    setEditMapsLink(room.mapsLink ?? "");
  };

  const handleUpdateRoom = async () => {
    if (!editName.trim()) return;
    setIsUpdating(true);
    try {
      await updateRoom({
        roomId: room._id,
        name: editName,
        type: editType,
        assignmentLimit: parseSharedLimit(editAssignmentLimit, editType),
        address: editAddress || undefined,
        directions: editDirections || undefined,
        mapsLink: editMapsLink || undefined,
      });
      toast.success("Room updated");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update room",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Edit room"
          onClick={openEditDialog}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Room</DialogTitle>
          <DialogDescription>
            Update room name, type, shared limit, and location details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={editType} onValueChange={setEditType}>
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
            </div>
          </div>
          {editType === "shared" && (
            <div>
              <Label className="text-xs">Shared idea limit</Label>
              <Input
                type="number"
                min={1}
                max={999}
                step={1}
                placeholder="Leave empty for no limit"
                value={editAssignmentLimit}
                onChange={(e) => setEditAssignmentLimit(e.target.value)}
              />
            </div>
          )}
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
              onChange={(e) => setEditDirections(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label className="text-xs">Maps Link</Label>
            <Input
              placeholder="https://maps.google.com/..."
              value={editMapsLink}
              onChange={(e) => setEditMapsLink(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateRoom}
            disabled={isUpdating || !editName.trim()}
          >
            {isUpdating && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
