"use client";

import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Search,
  Lightbulb,
  Trash2,
  DoorOpen,
  MapPin,
  Loader2,
  PlusCircle,
  Link2,
  Unlink,
  Pencil,
  RefreshCw,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  Navigation,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { toast, Toaster } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import {
  useProductBase,
  useSelectedHackathon,
} from "@/components/ProductLayoutClient";
import {
  STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
  TEAM_FORMATION_SOURCE_LABELS,
  TEAM_SIZE_LABELS,
} from "@/lib/constants";
import type {
  Status,
  RoomType,
  TeamFormationSource,
  TeamSize,
} from "@/lib/constants";
import type { RoomItem } from "@/lib/types";
import { useRolesMap } from "@/lib/hooks";

type IdeasReport = FunctionReturnType<typeof api.admin.ideasReport>;

const ALL_ROOM_STATES = "all";
const ALL_ONSITE_STATES = "all";
const WORKING_STATUSES: Status[] = STATUSES.filter(
  (status) => status !== "shelved",
);

function teamSizeCapacity(teamSize: TeamSize) {
  if (teamSize === "solo") return 1;
  if (teamSize === "small") return 3;
  if (teamSize === "medium") return 6;
  return 7;
}

function roomOccupancy(room: RoomItem) {
  if (room.type === "team") return `${room.assignedIdeaIds.length}/1`;
  if (room.assignmentLimit !== undefined) {
    return `${room.assignedIdeaIds.length}/${room.assignmentLimit}`;
  }
  return `${room.assignedIdeaIds.length} assigned`;
}

function roomCapacityLabel(room: RoomItem) {
  if (room.type === "team") return "1 idea";
  if (room.assignmentLimit !== undefined) return `${room.assignmentLimit} ideas`;
  return "No limit";
}

function roomIsAvailableForIdea(room: RoomItem, ideaId: Id<"ideas">) {
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

function parseSharedLimit(value: string, type: string) {
  if (type !== "shared") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return Number(trimmed);
}

function formatReportDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function tableCell(value: string | number | boolean | undefined) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function reportIdeaLine(idea: IdeasReport["ideas"][number]) {
  const room = idea.roomName
    ? `${idea.roomName}${idea.roomType ? ` (${idea.roomType})` : ""}`
    : "No room";
  return [
    tableCell(idea.title),
    tableCell(idea.ownerName),
    tableCell(STATUS_LABELS[idea.status as Status] ?? idea.status),
    tableCell(idea.memberCount),
    tableCell(room),
    tableCell(idea.roomRequestStatus),
    tableCell(idea.unresolvedResources),
    tableCell(idea.interest),
  ].join(" | ");
}

function decisionList(
  title: string,
  ideas: IdeasReport["ideas"],
  emptyText: string,
) {
  const rows = ideas.slice(0, 10);
  return [
    `### ${title}`,
    rows.length === 0
      ? emptyText
      : rows
          .map((idea) => {
            const roomText = idea.roomName ? `, room: ${idea.roomName}` : "";
            const roleText =
              idea.missingRoles.length > 0
                ? `, missing: ${idea.missingRoles.join(", ")}`
                : "";
            return `- ${idea.title} (${idea.ownerName}, ${idea.memberCount} members${roomText}${roleText})`;
          })
          .join("\n"),
  ].join("\n\n");
}

function buildIdeasReportMarkdown(report: IdeasReport) {
  const { summary } = report;
  const assignedPercent =
    summary.totalIdeas === 0
      ? 0
      : Math.round((summary.assignedIdeas / summary.totalIdeas) * 100);
  const activePercent =
    summary.totalIdeas === 0
      ? 0
      : Math.round((summary.activeIdeas / summary.totalIdeas) * 100);
  const updateBullets = [
    `${summary.activeIdeas}/${summary.totalIdeas} ideas are active (${activePercent}%).`,
    `${summary.assignedIdeas}/${summary.totalIdeas} ideas have rooms assigned (${assignedPercent}%).`,
    `${summary.roomRequests} ideas are waiting for room assignment.`,
    `${summary.shelvedIdeas} ideas are shelved.`,
    `${summary.resourceBlockedIdeas} active ideas have unresolved resource blockers.`,
  ];

  return [
    "# Fikra Ideas Report",
    `Generated ${formatReportDate(report.generatedAt)}`,
    "",
    "## Executive Summary",
    `- Total ideas: ${summary.totalIdeas}`,
    `- Active vs shelved: ${summary.activeIdeas} active, ${summary.shelvedIdeas} shelved`,
    `- Rooms: ${summary.assignedIdeas} assigned, ${summary.unassignedIdeas} unassigned`,
    `- Room pressure: ${summary.roomRequests} waiting, ${summary.readyWithoutRoomRequest} ready but not queued`,
    `- Blockers: ${summary.resourceBlockedIdeas} ideas with unresolved resources`,
    `- Activity: ${summary.totalComments} comments, ${summary.totalReactions} reactions, ${summary.totalInterest} interest signals`,
    "",
    "## Update-Ready Bullets",
    updateBullets.map((line) => `- ${line}`).join("\n"),
    "",
    "## Status Breakdown",
    "| Status | Count |",
    "| --- | ---: |",
    ...STATUSES.map(
      (status) =>
        `| ${tableCell(STATUS_LABELS[status])} | ${summary.byStatus[status] ?? 0} |`,
    ),
    "",
    "## Decision Queues",
    decisionList(
      "Assign Rooms",
      report.decisionQueues.roomRequests,
      "No ideas are currently waiting for room assignment.",
    ),
    "",
    decisionList(
      "Ready But Not Queued",
      report.decisionQueues.readyWithoutRoomRequest,
      "No ready teams are missing room requests.",
    ),
    "",
    decisionList(
      "Building Without Room",
      report.decisionQueues.buildingWithoutRoom,
      "No building ideas are missing rooms.",
    ),
    "",
    decisionList(
      "Resource Blockers",
      report.decisionQueues.resourceBlocked,
      "No active ideas have unresolved resource blockers.",
    ),
    "",
    decisionList(
      "Shelved Ideas",
      report.decisionQueues.shelvedIdeas,
      "No ideas are shelved.",
    ),
    "",
    "## Room Usage",
    "| Room | Type | Limit | Assigned | Ideas |",
    "| --- | --- | ---: | ---: | --- |",
    ...report.roomUsage.map(
      (room) =>
        `| ${tableCell(room.name)} | ${tableCell(room.type)} | ${tableCell(room.assignmentLimit ?? (room.type === "shared" ? "No limit" : 1))} | ${room.assignedIdeas} | ${tableCell(room.assignedIdeaTitles.join(", "))} |`,
    ),
    "",
    "## Idea Table",
    "| Idea | Owner | Status | Members | Room | Room State | Resources | Interest |",
    "| --- | --- | --- | ---: | --- | --- | ---: | ---: |",
    ...report.ideas.map(reportIdeaLine),
    "",
  ].join("\n");
}

function sameStatuses(a: Status[], b: Status[]) {
  return a.length === b.length && a.every((status) => b.includes(status));
}

function statusFilterLabel(statuses: Status[]) {
  if (statuses.length === STATUSES.length) return "All statuses";
  if (sameStatuses(statuses, WORKING_STATUSES)) return "All except shelved";
  if (statuses.length === 1) return STATUS_LABELS[statuses[0]];
  if (statuses.length === 0) return "No statuses";
  return `${statuses.length} statuses`;
}

export default function AdminIdeasPage() {
  const convex = useConvex();
  const hackathon = useSelectedHackathon();
  const hackathonId = hackathon?._id;
  const productBase = useProductBase();
  const hackathonArgs = hackathonId ? { hackathonId } : {};
  const ideas = useQuery(api.admin.listIdeas, hackathonArgs);
  const rooms = useQuery(api.rooms.list, hackathonArgs);
  const deleteIdea = useMutation(api.admin.deleteIdea);
  const updateIdeaStatus = useMutation(api.admin.updateIdeaStatus);
  const updateIdeaOnsiteOnly = useMutation(api.admin.updateIdeaOnsiteOnly);
  const markIdeaNeedsRoom = useMutation(api.rooms.markIdeaNeedsRoom);
  const createRoom = useMutation(api.rooms.create);
  const deleteRoom = useMutation(api.rooms.remove);
  const updateRoom = useMutation(api.rooms.update);
  const assignRoom = useMutation(api.rooms.assignToIdea);
  const unassignRoom = useMutation(api.rooms.unassignFromIdea);
  const queueFullIdeas = useMutation(api.rooms.queueFullIdeasForRooms);
  const roleLabels = useRolesMap();

  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>(() => [
    ...WORKING_STATUSES,
  ]);
  const [roomFilter, setRoomFilter] = useState(ALL_ROOM_STATES);
  const [onsiteFilter, setOnsiteFilter] = useState(ALL_ONSITE_STATES);
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

  const [name, setName] = useState("");
  const [type, setType] = useState<string>("team");
  const [assignmentLimit, setAssignmentLimit] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<Id<"rooms"> | null>(
    null,
  );
  const [editRoomId, setEditRoomId] = useState<Id<"rooms"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<string>("team");
  const [editAssignmentLimit, setEditAssignmentLimit] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDirections, setEditDirections] = useState("");
  const [editMapsLink, setEditMapsLink] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const filtered = useMemo(() => {
    if (!ideas) return [];
    const q = search.toLowerCase().trim();
    return ideas.filter((idea) => {
      const matchesSearch =
        !q ||
        idea.title.toLowerCase().includes(q) ||
        idea.ownerName.toLowerCase().includes(q) ||
        idea.ownerEmail?.toLowerCase().includes(q);
      const matchesStatus =
        selectedStatuses.length === STATUSES.length ||
        selectedStatuses.includes(idea.status as Status);
      const matchesRoom =
        roomFilter === ALL_ROOM_STATES ||
        (roomFilter === "assigned" && idea.roomId) ||
        (roomFilter === "requested" &&
          idea.roomRequestStatus === "requested") ||
        (roomFilter === "none" &&
          !idea.roomId &&
          idea.roomRequestStatus !== "requested");
      const matchesOnsite =
        onsiteFilter === ALL_ONSITE_STATES ||
        (onsiteFilter === "onsite" && idea.onsiteOnly) ||
        (onsiteFilter === "open" && !idea.onsiteOnly);

      return matchesSearch && matchesStatus && matchesRoom && matchesOnsite;
    });
  }, [ideas, onsiteFilter, roomFilter, search, selectedStatuses]);

  const roomList = rooms ?? [];
  const ideaList = ideas ?? [];
  const waitingIdeas = ideaList.filter(
    (idea) => !idea.roomId && idea.roomRequestStatus === "requested",
  );
  const readyTeamsMissingRoom = ideaList.filter(
    (idea) =>
      !idea.roomId &&
      idea.roomRequestStatus !== "requested" &&
      (idea.status === "full" ||
        idea.memberCount >= teamSizeCapacity(idea.teamSize as TeamSize)),
  );
  const openTeamRooms = roomList.filter(
    (room) => room.type === "team" && room.assignedIdeaIds.length === 0,
  );
  const assignedRooms = roomList.filter(
    (room) => room.assignedIdeaIds.length > 0,
  );
  const onsiteIdeas = ideaList.filter((idea) => idea.onsiteOnly);

  const toggleStatusFilter = (status: Status) => {
    setSelectedStatuses((current) =>
      current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status],
    );
  };

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

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const report = await convex.query(api.admin.ideasReport, hackathonArgs);
      const markdown = buildIdeasReportMarkdown(report);
      const blob = new Blob([markdown], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date(report.generatedAt).toISOString().slice(0, 10);
      link.href = url;
      link.download = `fikra-ideas-report-${date}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Ideas report generated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate report",
      );
    } finally {
      setIsGeneratingReport(false);
    }
  };

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

  const openEditDialog = (room: RoomItem) => {
    setEditRoomId(room._id);
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
    if (!editRoomId || !editName.trim()) return;
    setIsUpdating(true);
    try {
      await updateRoom({
        roomId: editRoomId,
        name: editName,
        type: editType,
        assignmentLimit: parseSharedLimit(editAssignmentLimit, editType),
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

  if (ideas === undefined || rooms === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading ideas and rooms...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href={`${productBase}/admin`}
            className="mt-1 text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Lightbulb className="h-6 w-6" />
              Ideas & Rooms
            </h1>
            <p className="text-sm text-muted-foreground">
              {ideas.length} ideas · {waitingIdeas.length} waiting ·{" "}
              {rooms.length} rooms
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => void handleGenerateReport()}
            disabled={isGeneratingReport}
          >
            {isGeneratingReport ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Generate report
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => void handleCheckFullIdeas()}
            disabled={isCheckingFullIdeas}
          >
            {isCheckingFullIdeas ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Check ready teams
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-l-4 border-l-amber-400 bg-amber-50/60 px-4 py-3 dark:bg-amber-950/20">
          <p className="text-xs font-medium uppercase text-amber-900 dark:text-amber-200">
            Waiting for room
          </p>
          <p className="mt-1 text-2xl font-bold">{waitingIdeas.length}</p>
        </div>
        <div className="border-l-4 border-l-emerald-400 bg-emerald-50/60 px-4 py-3 dark:bg-emerald-950/20">
          <p className="text-xs font-medium uppercase text-emerald-900 dark:text-emerald-200">
            Open team rooms
          </p>
          <p className="mt-1 text-2xl font-bold">{openTeamRooms.length}</p>
        </div>
        <div className="border-l-4 border-l-blue-400 bg-blue-50/60 px-4 py-3 dark:bg-blue-950/20">
          <p className="text-xs font-medium uppercase text-blue-900 dark:text-blue-200">
            Assigned rooms
          </p>
          <p className="mt-1 text-2xl font-bold">{assignedRooms.length}</p>
        </div>
        <div className="border-l-4 border-l-stone-400 bg-stone-50/70 px-4 py-3 dark:bg-stone-950/20">
          <p className="text-xs font-medium uppercase text-stone-700 dark:text-stone-200">
            On-site ideas
          </p>
          <p className="mt-1 text-2xl font-bold">{onsiteIdeas.length}</p>
        </div>
      </div>

      {readyTeamsMissingRoom.length > 0 && (
        <div className="flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span>
              {readyTeamsMissingRoom.length} ready-looking team
              {readyTeamsMissingRoom.length === 1 ? "" : "s"} without a room
              request.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 bg-background"
            onClick={() => void handleCheckFullIdeas()}
            disabled={isCheckingFullIdeas}
          >
            Queue them
          </Button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ideas, owners, or email..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 justify-between gap-2 lg:w-[190px]"
                >
                  <span className="truncate">
                    {statusFilterLabel(selectedStatuses)}
                  </span>
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Status filter</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => setSelectedStatuses([...STATUSES])}
                >
                  All statuses
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setSelectedStatuses([...WORKING_STATUSES])}
                >
                  All except shelved
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setSelectedStatuses(["shelved"])}
                >
                  Shelved only
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {STATUSES.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={() => toggleStatusFilter(status)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {STATUS_LABELS[status]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Select value={roomFilter} onValueChange={setRoomFilter}>
              <SelectTrigger className="lg:w-[165px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ROOM_STATES}>All room states</SelectItem>
                <SelectItem value="requested">Needs room</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="none">No request</SelectItem>
              </SelectContent>
            </Select>
            <Select value={onsiteFilter} onValueChange={setOnsiteFilter}>
              <SelectTrigger className="lg:w-[145px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ONSITE_STATES}>All modes</SelectItem>
                <SelectItem value="onsite">On-site only</SelectItem>
                <SelectItem value="open">Open to all</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Idea</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Missing Roles</TableHead>
                  <TableHead className="min-w-[290px]">Room</TableHead>
                  <TableHead>On-site</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-muted-foreground"
                    >
                      {search ? "No ideas match your filters" : "No ideas found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((idea) => {
                    const selectedRoomId = selectedRoomByIdea[idea._id];
                    const selectedRoom = rooms.find(
                      (room) => room._id === selectedRoomId,
                    );
                    const selectedRoomIsAvailable =
                      selectedRoom &&
                      roomIsAvailableForIdea(selectedRoom, idea._id);
                    const isAssigningThisIdea = assigningIdeaId === idea._id;

                    return (
                      <TableRow key={idea._id}>
                        <TableCell>
                          <Link
                            href={`${productBase}/ideas/${idea._id}`}
                            className="font-medium text-sm hover:underline"
                          >
                            {idea.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {new Date(idea._creationTime).toLocaleDateString()} ·{" "}
                            {idea.commentCount} comments ·{" "}
                            {idea.reactionCount} reactions
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{idea.ownerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {idea.ownerEmail}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={idea.status}
                            onValueChange={(v) =>
                              handleStatusChange(idea._id, v as Status)
                            }
                          >
                            <SelectTrigger className="h-8 w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  <Badge
                                    variant="outline"
                                    className={STATUS_COLORS[status]}
                                  >
                                    {STATUS_LABELS[status]}
                                  </Badge>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm">
                          {idea.memberCount} ·{" "}
                          {TEAM_SIZE_LABELS[idea.teamSize as TeamSize]}
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-[210px] flex-wrap gap-1">
                            {idea.lookingForRoles.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                None
                              </span>
                            ) : (
                              idea.lookingForRoles.map((role: string) => (
                                <Badge
                                  key={role}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {roleLabels[role] || role}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
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
                                onClick={() =>
                                  void handleUnassignRoom(idea._id)
                                }
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
                                    onClick={() =>
                                      void handleMarkNeedsRoom(idea._id)
                                    }
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
                                      const disabled = !roomIsAvailableForIdea(
                                        room,
                                        idea._id,
                                      );

                                      return (
                                        <SelectItem
                                          key={room._id}
                                          value={room._id}
                                          disabled={disabled}
                                        >
                                          {room.name} ·{" "}
                                          {ROOM_TYPE_LABELS[
                                            room.type as RoomType
                                          ] || room.type}{" "}
                                          ({roomOccupancy(room)}
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
                                  onClick={() =>
                                    void handleAssignRoom(idea._id)
                                  }
                                  disabled={
                                    !selectedRoomIsAvailable ||
                                    isAssigningThisIdea
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
                          )}
                        </TableCell>
                        <TableCell>
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={idea.onsiteOnly ?? false}
                              onChange={(e) =>
                                handleOnsiteOnlyChange(
                                  idea._id,
                                  e.target.checked,
                                )
                              }
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
                            onClick={() =>
                              handleDeleteIdea(idea._id, idea.title)
                            }
                            className="h-8 gap-1 text-xs"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
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

          <div className="overflow-hidden border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Rooms</h2>
                <p className="text-xs text-muted-foreground">
                  {rooms.length} total · {openTeamRooms.length} team open
                </p>
              </div>
              {waitingIdeas.length === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Badge>{waitingIdeas.length} waiting</Badge>
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
                                room.type === "shared"
                                  ? "default"
                                  : "secondary"
                              }
                              className="shrink-0 text-[10px]"
                            >
                              {ROOM_TYPE_LABELS[room.type as RoomType] ||
                                room.type}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {roomOccupancy(room)} · {roomCapacityLabel(room)}
                            {isFull ? " · full" : ""}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
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
                                title="Edit room"
                                onClick={() => openEditDialog(room)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Room</DialogTitle>
                                <DialogDescription>
                                  Update room name, type, shared limit, and
                                  location details.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-3">
                                <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                                  <div>
                                    <Label className="text-xs">Name</Label>
                                    <Input
                                      value={editName}
                                      onChange={(e) =>
                                        setEditName(e.target.value)
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Type</Label>
                                    <Select
                                      value={editType}
                                      onValueChange={setEditType}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {ROOM_TYPES.map((roomType) => (
                                          <SelectItem
                                            key={roomType}
                                            value={roomType}
                                          >
                                            {ROOM_TYPE_LABELS[roomType]}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                {editType === "shared" && (
                                  <div>
                                    <Label className="text-xs">
                                      Shared idea limit
                                    </Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={999}
                                      step={1}
                                      placeholder="Leave empty for no limit"
                                      value={editAssignmentLimit}
                                      onChange={(e) =>
                                        setEditAssignmentLimit(e.target.value)
                                      }
                                    />
                                  </div>
                                )}
                                <div>
                                  <Label className="text-xs">Address</Label>
                                  <Input
                                    placeholder="Building, floor, room number..."
                                    value={editAddress}
                                    onChange={(e) =>
                                      setEditAddress(e.target.value)
                                    }
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
                                  onClick={handleUpdateRoom}
                                  disabled={isUpdating || !editName.trim()}
                                >
                                  {isUpdating && (
                                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
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
      </div>

      <Toaster />
    </div>
  );
}
