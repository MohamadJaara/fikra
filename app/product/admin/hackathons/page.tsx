"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Copy,
  PauseCircle,
  Pencil,
  PlayCircle,
  PlusCircle,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { useProductBase } from "@/components/ProductLayoutClient";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

type HackathonItem = FunctionReturnType<
  typeof api.hackathons.getForAdmin
>[number];

function toLocalInputValue(timestamp: number) {
  const date = new Date(timestamp);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

const DEFAULT_START_AT = toLocalInputValue(
  Date.now() + 7 * 24 * 60 * 60 * 1000,
);

export default function AdminHackathonsPage() {
  const productBase = useProductBase();
  const hackathons = useQuery(api.hackathons.getForAdmin, {});
  const createHackathon = useMutation(api.hackathons.create);
  const activateHackathon = useMutation(api.hackathons.activate);
  const completeHackathon = useMutation(api.hackathons.complete);
  const archiveHackathon = useMutation(api.hackathons.archive);
  const cloneConfig = useMutation(api.hackathons.cloneConfigFrom);
  const updateHackathon = useMutation(api.hackathons.update);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [startsAt, setStartsAt] = useState(DEFAULT_START_AT);
  const [endsAt, setEndsAt] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [cloneFromHackathonId, setCloneFromHackathonId] = useState<
    Id<"hackathons"> | "none"
  >("none");
  const [isCreating, setIsCreating] = useState(false);
  const [cloningTargetId, setCloningTargetId] =
    useState<Id<"hackathons"> | null>(null);
  const [editingHackathon, setEditingHackathon] =
    useState<HackathonItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [editTimezone, setEditTimezone] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editNote, setEditNote] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const openEditDialog = (hackathon: HackathonItem) => {
    setEditingHackathon(hackathon);
    setEditTitle(hackathon.title);
    setEditSlug(hackathon.slug);
    setEditStartsAt(toLocalInputValue(hackathon.startsAt));
    setEditEndsAt(hackathon.endsAt ? toLocalInputValue(hackathon.endsAt) : "");
    setEditTimezone(hackathon.timezone);
    setEditLocation(hackathon.location ?? "");
    setEditNote(hackathon.note ?? "");
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      await createHackathon({
        title,
        slug: optionalText(slug),
        startsAt: new Date(startsAt).getTime(),
        endsAt: endsAt ? new Date(endsAt).getTime() : undefined,
        timezone,
        location: optionalText(location),
        note: optionalText(note),
        status: "upcoming",
        cloneFromHackathonId:
          cloneFromHackathonId === "none" ? undefined : cloneFromHackathonId,
      });
      toast.success("Hackathon created");
      setTitle("");
      setSlug("");
      setStartsAt(DEFAULT_START_AT);
      setEndsAt("");
      setLocation("");
      setNote("");
      setCloneFromHackathonId("none");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create hackathon",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleLifecycle = async (
    action: "activate" | "complete" | "archive",
    hackathonId: Id<"hackathons">,
  ) => {
    try {
      if (action === "activate") await activateHackathon({ hackathonId });
      if (action === "complete") await completeHackathon({ hackathonId });
      if (action === "archive") await archiveHackathon({ hackathonId });
      toast.success("Hackathon updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update hackathon",
      );
    }
  };

  const handleClone = async (
    sourceHackathonId: Id<"hackathons">,
    targetHackathonId: Id<"hackathons">,
  ) => {
    setCloningTargetId(targetHackathonId);
    try {
      await cloneConfig({ sourceHackathonId, targetHackathonId });
      toast.success("Configuration cloned");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to clone config",
      );
    } finally {
      setCloningTargetId(null);
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingHackathon || !editTitle.trim() || !editStartsAt) return;
    setIsUpdating(true);
    try {
      await updateHackathon({
        hackathonId: editingHackathon._id,
        title: editTitle,
        slug: optionalText(editSlug),
        startsAt: new Date(editStartsAt).getTime(),
        endsAt: editEndsAt ? new Date(editEndsAt).getTime() : undefined,
        timezone: editTimezone,
        location: optionalText(editLocation),
        note: optionalText(editNote),
        status: editingHackathon.status,
      });
      toast.success("Hackathon saved");
      setEditingHackathon(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save hackathon",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  if (hackathons === undefined) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="h-8 w-56 animate-pulse rounded bg-muted/50" />
        <div className="mt-6 h-64 animate-pulse rounded-lg bg-muted/40" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`${productBase}/admin`}
          className="text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Hackathons</h1>
          <p className="text-sm text-muted-foreground">
            Create, activate, complete, archive, and clone setup
          </p>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-4 rounded-lg border bg-background p-4 md:grid-cols-2"
      >
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="hackathon-title">Title</Label>
          <Input
            id="hackathon-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Internal Hackathon 2026"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hackathon-slug">Slug</Label>
          <Input
            id="hackathon-slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="internal-hackathon-2026"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hackathon-timezone">Timezone</Label>
          <Input
            id="hackathon-timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hackathon-start">Starts</Label>
          <Input
            id="hackathon-start"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hackathon-end">Ends</Label>
          <Input
            id="hackathon-end"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hackathon-location">Location</Label>
          <Input
            id="hackathon-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="HQ, Berlin, remote"
          />
        </div>
        <div className="space-y-2">
          <Label>Clone Config</Label>
          <Select
            value={cloneFromHackathonId}
            onValueChange={(value) =>
              setCloneFromHackathonId(value as Id<"hackathons"> | "none")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No clone</SelectItem>
              {hackathons.map((hackathon) => (
                <SelectItem key={hackathon._id} value={hackathon._id}>
                  {hackathon.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="hackathon-note">Note</Label>
          <Textarea
            id="hackathon-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
          />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={isCreating || !title.trim()}>
            <PlusCircle className="h-4 w-4 mr-2" />
            {isCreating ? "Creating..." : "Create Hackathon"}
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[1fr_auto] gap-3 border-b bg-muted/30 px-4 py-3 text-sm font-medium md:grid-cols-[1.4fr_0.8fr_1fr_auto]">
          <span>Hackathon</span>
          <span className="hidden md:block">Dates</span>
          <span className="hidden md:block">Status</span>
          <span>Actions</span>
        </div>
        <div className="divide-y">
          {hackathons.map((hackathon) => {
            const cloneSource = hackathons.find(
              (item) => item._id !== hackathon._id,
            );
            return (
              <div
                key={hackathon._id}
                className="grid grid-cols-[1fr_auto] gap-3 px-4 py-4 md:grid-cols-[1.4fr_0.8fr_1fr_auto]"
              >
                <div className="min-w-0">
                  <Link
                    href={`/product/h/${hackathon.slug}`}
                    className="font-medium hover:text-primary"
                  >
                    {hackathon.title}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    /product/h/{hackathon.slug}
                  </p>
                </div>
                <div className="hidden text-sm text-muted-foreground md:block">
                  {new Date(hackathon.startsAt).toLocaleDateString()}
                  {hackathon.endsAt
                    ? ` - ${new Date(hackathon.endsAt).toLocaleDateString()}`
                    : ""}
                </div>
                <div className="hidden md:block">
                  <Badge variant="outline">
                    {STATUS_LABELS[hackathon.status] ?? hackathon.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Edit ${hackathon.title}`}
                    onClick={() => openEditDialog(hackathon)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {hackathon.status !== "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void handleLifecycle("activate", hackathon._id)
                      }
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {hackathon.status !== "completed" &&
                    hackathon.status !== "archived" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void handleLifecycle("complete", hackathon._id)
                        }
                      >
                        <PauseCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  {cloneSource && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cloningTargetId === hackathon._id}
                      onClick={() =>
                        void handleClone(cloneSource._id, hackathon._id)
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {hackathon.status !== "archived" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void handleLifecycle("archive", hackathon._id)
                      }
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {hackathon.status === "active" && (
                    <Badge className="h-8 gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Active
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={editingHackathon !== null}
        onOpenChange={(open) => {
          if (!open && !isUpdating) setEditingHackathon(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Hackathon</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-hackathon-title">Title</Label>
              <Input
                id="edit-hackathon-title"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hackathon-slug">Slug</Label>
              <Input
                id="edit-hackathon-slug"
                value={editSlug}
                onChange={(event) => setEditSlug(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hackathon-timezone">Timezone</Label>
              <Input
                id="edit-hackathon-timezone"
                value={editTimezone}
                onChange={(event) => setEditTimezone(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hackathon-start">Starts</Label>
              <Input
                id="edit-hackathon-start"
                type="datetime-local"
                value={editStartsAt}
                onChange={(event) => setEditStartsAt(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hackathon-end">Ends</Label>
              <Input
                id="edit-hackathon-end"
                type="datetime-local"
                value={editEndsAt}
                onChange={(event) => setEditEndsAt(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-hackathon-location">Location</Label>
              <Input
                id="edit-hackathon-location"
                value={editLocation}
                onChange={(event) => setEditLocation(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-hackathon-note">Note</Label>
              <Textarea
                id="edit-hackathon-note"
                value={editNote}
                onChange={(event) => setEditNote(event.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingHackathon(null)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isUpdating || !editTitle.trim() || !editStartsAt}
              >
                <Save className="h-4 w-4 mr-2" />
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}
