"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { STATUSES, STATUS_LABELS, type Status } from "@/lib/constants";
import { useRolesMap } from "@/lib/hooks";
import type { RoomItem } from "@/lib/types";
import { AdminIdeaRow } from "./AdminIdeaRow";
import type { AdminIdea } from "./types";

const ALL_ROOM_STATES = "all";
const ALL_ONSITE_STATES = "all";
const WORKING_STATUSES: Status[] = STATUSES.filter(
  (status) => status !== "shelved",
);

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

export function AdminIdeasTable({
  ideas,
  rooms,
  productBase,
}: {
  ideas: AdminIdea[];
  rooms: RoomItem[];
  productBase: string;
}) {
  const roleLabels = useRolesMap();
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>(() => [
    ...WORKING_STATUSES,
  ]);
  const [roomFilter, setRoomFilter] = useState(ALL_ROOM_STATES);
  const [onsiteFilter, setOnsiteFilter] = useState(ALL_ONSITE_STATES);
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

  const toggleStatusFilter = (status: Status) => {
    setSelectedStatuses((current) =>
      current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status],
    );
  };

  return (
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
            <DropdownMenuItem onSelect={() => setSelectedStatuses(["shelved"])}>
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
              filtered.map((idea) => (
                <AdminIdeaRow
                  key={idea._id}
                  idea={idea}
                  rooms={rooms}
                  productBase={productBase}
                  roleLabels={roleLabels}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
