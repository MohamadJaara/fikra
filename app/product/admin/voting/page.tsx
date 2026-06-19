"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Users,
  Vote,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast, Toaster } from "sonner";

function formatTime(value?: number) {
  if (!value) return "Not started";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminVotingPage() {
  const overview = useQuery(api.voting.adminOverview);
  const results = useQuery(api.voting.results);
  const startVoting = useMutation(api.voting.start);
  const stopVoting = useMutation(api.voting.stop);
  const [saving, setSaving] = useState<"start" | "stop" | null>(null);

  const maxVotes = Math.max(...(results ?? []).map((row) => row.voteCount), 1);

  const handleStart = async () => {
    setSaving("start");
    try {
      const result = await startVoting();
      toast.success(`Voting round ${result.currentRound} started`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start");
    } finally {
      setSaving(null);
    }
  };

  const handleStop = async () => {
    setSaving("stop");
    try {
      await stopVoting();
      toast.success("Voting stopped");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to stop");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/product/admin"
            className="mt-1 text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Vote className="h-6 w-6" />
              Voting
            </h1>
            <p className="text-sm text-muted-foreground">
              Open participant voting and watch private admin-only results.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {overview?.active ? (
            <Button
              variant="outline"
              onClick={handleStop}
              disabled={saving !== null}
              className="gap-2"
            >
              {saving === "stop" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PauseCircle className="h-4 w-4" />
              )}
              Stop voting
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              disabled={saving !== null}
              className="gap-2"
            >
              {saving === "start" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : overview?.currentRound ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {overview?.currentRound ? "Start new round" : "Start voting"}
            </Button>
          )}
        </div>
      </div>

      {overview === undefined || results === undefined ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-background p-4">
              <Badge
                variant="outline"
                className={
                  overview.active
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : "border-stone-300 bg-stone-50 text-stone-700 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-200"
                }
              >
                {overview.active ? "Open" : "Closed"}
              </Badge>
              <p className="mt-3 text-2xl font-bold">
                Round {overview.currentRound || 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Started {formatTime(overview.startedAt)}
              </p>
            </div>
            <div className="bg-background p-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Vote className="h-3.5 w-3.5" />
                Votes
              </p>
              <p className="mt-3 text-2xl font-bold">{overview.totalVotes}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Current round only
              </p>
            </div>
            <div className="bg-background p-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Voters
              </p>
              <p className="mt-3 text-2xl font-bold">{overview.totalVoters}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Unique participants
              </p>
            </div>
            <div className="bg-background p-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" />
                Ballot
              </p>
              <p className="mt-3 text-2xl font-bold">
                {overview.ballotIdeaCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Unshelved ideas
              </p>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Results</h2>
                <p className="text-xs text-muted-foreground">
                  Visible only to admins. Participants can only see their own
                  selected votes.
                </p>
              </div>
              {overview.endedAt && !overview.active && (
                <Badge variant="outline">Stopped {formatTime(overview.endedAt)}</Badge>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border">
              {results.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No unshelved ideas are available for this ballot.
                </div>
              ) : (
                results.map((idea, index) => (
                  <Link
                    key={idea._id}
                    href={`/product/ideas/${idea._id}`}
                    className="block border-b p-4 transition-colors last:border-b-0 hover:bg-muted/50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="w-6 shrink-0 text-xs font-mono text-muted-foreground">
                            #{index + 1}
                          </span>
                          <h3 className="truncate font-medium">{idea.title}</h3>
                        </div>
                        <p className="mt-1 line-clamp-2 pl-8 text-sm text-muted-foreground">
                          {idea.pitch}
                        </p>
                        <p className="mt-2 pl-8 text-xs text-muted-foreground">
                          {idea.ownerName}
                          {idea.categoryName ? ` · ${idea.categoryName}` : ""}
                        </p>
                      </div>
                      <div className="min-w-[9rem] sm:text-right">
                        <p className="text-2xl font-bold">{idea.voteCount}</p>
                        <p className="text-xs text-muted-foreground">
                          vote{idea.voteCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <Progress
                      value={(idea.voteCount / maxVotes) * 100}
                      className="mt-4 h-2"
                    />
                  </Link>
                ))
              )}
            </div>
          </section>
        </>
      )}

      <Toaster />
    </div>
  );
}
