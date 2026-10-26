"use client";

import { useQuery } from "convex/react";
import { ArrowLeft, Lightbulb } from "lucide-react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import {
  useProductBase,
  useSelectedHackathon,
} from "@/components/ProductLayoutClient";
import { AdminIdeasTable } from "@/components/admin/ideas/AdminIdeasTable";
import { IdeasReportButton } from "@/components/admin/ideas/IdeasReportButton";
import { RoomAllocationProvider } from "@/components/admin/ideas/RoomAllocationProvider";
import {
  CheckReadyTeamsButton,
  RoomAllocationSummary,
} from "@/components/admin/ideas/RoomAllocationSummary";
import { RoomInventory } from "@/components/admin/ideas/RoomInventory";
import { teamSizeCapacity } from "@/components/admin/ideas/rooms";
import type { TeamSize } from "@/lib/constants";

export default function AdminIdeasPage() {
  const hackathon = useSelectedHackathon();
  const hackathonId = hackathon?._id;
  const productBase = useProductBase();
  const hackathonArgs = hackathonId ? { hackathonId } : {};
  const ideas = useQuery(api.admin.listIdeas, hackathonArgs);
  const rooms = useQuery(api.rooms.list, hackathonArgs);
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

  if (ideas === undefined || rooms === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading ideas and rooms...</div>
      </div>
    );
  }

  return (
    <RoomAllocationProvider hackathonId={hackathonId}>
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
            <IdeasReportButton hackathonId={hackathonId} />
            <CheckReadyTeamsButton />
          </div>
        </div>

        <RoomAllocationSummary
          waitingIdeaCount={waitingIdeas.length}
          openTeamRoomCount={openTeamRooms.length}
          assignedRoomCount={assignedRooms.length}
          onsiteIdeaCount={onsiteIdeas.length}
          readyTeamCount={readyTeamsMissingRoom.length}
        />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AdminIdeasTable
            ideas={ideas}
            rooms={rooms}
            productBase={productBase}
          />
          <RoomInventory
            rooms={rooms}
            hackathonId={hackathonId}
            productBase={productBase}
            openTeamRoomCount={openTeamRooms.length}
            waitingIdeaCount={waitingIdeas.length}
          />
        </div>
      </div>
    </RoomAllocationProvider>
  );
}
