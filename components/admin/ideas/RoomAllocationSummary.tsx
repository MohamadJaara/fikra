"use client";

import { ClipboardList, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoomAllocation } from "./RoomAllocationProvider";

export function CheckReadyTeamsButton() {
  const { isCheckingFullIdeas, handleCheckFullIdeas } = useRoomAllocation();
  return (
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
  );
}

export function RoomAllocationSummary({
  waitingIdeaCount,
  openTeamRoomCount,
  assignedRoomCount,
  onsiteIdeaCount,
  readyTeamCount,
}: {
  waitingIdeaCount: number;
  openTeamRoomCount: number;
  assignedRoomCount: number;
  onsiteIdeaCount: number;
  readyTeamCount: number;
}) {
  const { isCheckingFullIdeas, handleCheckFullIdeas } = useRoomAllocation();
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-l-4 border-l-amber-400 bg-amber-50/60 px-4 py-3 dark:bg-amber-950/20">
          <p className="text-xs font-medium uppercase text-amber-900 dark:text-amber-200">
            Waiting for room
          </p>
          <p className="mt-1 text-2xl font-bold">{waitingIdeaCount}</p>
        </div>
        <div className="border-l-4 border-l-emerald-400 bg-emerald-50/60 px-4 py-3 dark:bg-emerald-950/20">
          <p className="text-xs font-medium uppercase text-emerald-900 dark:text-emerald-200">
            Open team rooms
          </p>
          <p className="mt-1 text-2xl font-bold">{openTeamRoomCount}</p>
        </div>
        <div className="border-l-4 border-l-blue-400 bg-blue-50/60 px-4 py-3 dark:bg-blue-950/20">
          <p className="text-xs font-medium uppercase text-blue-900 dark:text-blue-200">
            Assigned rooms
          </p>
          <p className="mt-1 text-2xl font-bold">{assignedRoomCount}</p>
        </div>
        <div className="border-l-4 border-l-stone-400 bg-stone-50/70 px-4 py-3 dark:bg-stone-950/20">
          <p className="text-xs font-medium uppercase text-stone-700 dark:text-stone-200">
            On-site ideas
          </p>
          <p className="mt-1 text-2xl font-bold">{onsiteIdeaCount}</p>
        </div>
      </div>

      {readyTeamCount > 0 && (
        <div className="flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span>
              {readyTeamCount} ready-looking team
              {readyTeamCount === 1 ? "" : "s"} without a room request.
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
    </>
  );
}
