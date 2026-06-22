"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  useProductViewer,
  useSelectedHackathon,
} from "@/components/ProductLayoutClient";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { STATUS_LABELS, TEAM_SIZE_LABELS, type Status } from "@/lib/constants";
import { useMutation, useQuery } from "convex/react";
import {
  BarChart3,
  Check,
  Clock3,
  Loader2,
  PauseCircle,
  Search,
  Users,
  Vote,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast, Toaster } from "sonner";

type BallotIdea = {
  _id: Id<"ideas">;
  title: string;
  pitch: string;
  status: string;
  teamSize: keyof typeof TEAM_SIZE_LABELS;
  ownerName: string;
  ownerHandle?: string;
  categoryName?: string;
  memberCount: number;
  interestCount: number;
  reactionTotal: number;
  userVoted: boolean;
};

export default function VotingPage() {
  const viewer = useProductViewer();
  const hackathon = useSelectedHackathon();
  const status = useQuery(api.voting.status, { hackathonId: hackathon?._id });
  const ballot = useQuery(api.voting.ballot, { hackathonId: hackathon?._id });
  const adminOverview = useQuery(
    api.voting.adminOverview,
    viewer.isAdmin ? { hackathonId: hackathon?._id } : "skip",
  );
  const showFinalResults =
    status !== undefined &&
    !status.active &&
    status.currentRound > 0 &&
    status.endedAt !== undefined;
  const results = useQuery(
    api.voting.results,
    viewer.isAdmin || showFinalResults ? { hackathonId: hackathon?._id } : "skip",
  );
  const toggleVote = useMutation(api.voting.toggleVote);
  const stopVoting = useMutation(api.voting.stop);
  const [query, setQuery] = useState("");
  const [pendingIdeaId, setPendingIdeaId] = useState<Id<"ideas"> | null>(null);
  const [stopping, setStopping] = useState(false);

  const ideas = useMemo(() => (ballot ?? []) as BallotIdea[], [ballot]);
  const maxVotes = Math.max(...(results ?? []).map((row) => row.voteCount), 1);
  const filteredIdeas = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return ideas;
    return ideas.filter(
      (idea) =>
        idea.title.toLowerCase().includes(term) ||
        idea.pitch.toLowerCase().includes(term) ||
        idea.ownerName.toLowerCase().includes(term) ||
        idea.categoryName?.toLowerCase().includes(term),
    );
  }, [ideas, query]);

  const handleVote = async (idea: BallotIdea) => {
    setPendingIdeaId(idea._id);
    try {
      const result = await toggleVote({
        ideaId: idea._id,
        hackathonId: hackathon?._id,
      });
      toast.success(result.voted ? "Vote added" : "Vote removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Vote failed");
    } finally {
      setPendingIdeaId(null);
    }
  };

  const handleStopVoting = async () => {
    setStopping(true);
    try {
      await stopVoting({ hackathonId: hackathon?._id });
      toast.success("Voting stopped");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to stop");
    } finally {
      setStopping(false);
    }
  };

  if (
    status === undefined ||
    ballot === undefined ||
    (showFinalResults && results === undefined)
  ) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status.active) {
    if (showFinalResults) {
      return (
        <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
          <div className="border-b pb-5">
            <Badge variant="outline" className="mb-2 gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Results posted
            </Badge>
            <h1 className="text-2xl font-bold">Voting Results</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Voting has ended. Here are the final results for round{" "}
              {status.currentRound}.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border">
            {results?.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No unshelved ideas were available for this ballot.
              </div>
            ) : (
              results?.map((idea, index) => (
                <div key={idea._id} className="border-b p-4 last:border-b-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                          #{index + 1}
                        </span>
                        <h2 className="truncate font-medium">{idea.title}</h2>
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
                </div>
              ))
            )}
          </div>

          <Toaster />
        </div>
      );
    }

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border bg-muted/40">
          <Clock3 className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Voting has not started</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Once an admin opens voting, the active idea board will appear here.
        </p>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Voting open
            </Badge>
            <span className="text-xs text-muted-foreground">
              {status.viewerVoteCount} vote
              {status.viewerVoteCount === 1 ? "" : "s"} selected
            </span>
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Vote className="h-6 w-6" />
            Vote For Ideas
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pick the unshelved ideas you want to back. Your selections can be
            changed while voting is open. Idea browsing is locked to this page.
          </p>
        </div>

        <label className="relative block md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ballot"
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </label>
      </div>

      {viewer.isAdmin && (
        <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <BarChart3 className="h-4 w-4" />
                Admin Results
              </h2>
              <p className="text-xs text-muted-foreground">
                Visible only to admins. Everyone else only sees their own
                selected votes.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleStopVoting}
              disabled={stopping}
              className="gap-2"
            >
              {stopping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PauseCircle className="h-4 w-4" />
              )}
              Stop voting
            </Button>
          </div>

          {adminOverview === undefined || results === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
                <div className="bg-background p-3">
                  <p className="text-xs text-muted-foreground">Votes</p>
                  <p className="mt-1 text-2xl font-bold">
                    {adminOverview.totalVotes}
                  </p>
                </div>
                <div className="bg-background p-3">
                  <p className="text-xs text-muted-foreground">Voters</p>
                  <p className="mt-1 text-2xl font-bold">
                    {adminOverview.totalVoters}
                  </p>
                </div>
                <div className="bg-background p-3">
                  <p className="text-xs text-muted-foreground">Ballot</p>
                  <p className="mt-1 text-2xl font-bold">
                    {adminOverview.ballotIdeaCount}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-border/60 rounded-lg border bg-background">
                {results.slice(0, 8).map((idea, index) => (
                  <div key={idea._id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          #{index + 1} {idea.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {idea.ownerName}
                          {idea.categoryName ? ` · ${idea.categoryName}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{idea.voteCount}</p>
                        <p className="text-[11px] text-muted-foreground">
                          vote{idea.voteCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <Progress
                      value={(idea.voteCount / maxVotes) * 100}
                      className="mt-2 h-1.5"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {ideas.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="text-lg font-semibold">No ideas on the ballot</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Unshelved ideas will show up here while voting is open.
          </p>
        </div>
      ) : filteredIdeas.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="text-lg font-semibold">No matching ideas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different title, owner, or category.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {filteredIdeas.map((idea, index) => (
            <div
              key={idea._id}
              className={`grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_9rem] md:items-center animate-fade-in stagger-${Math.min(index + 1, 9)}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">{idea.title}</h2>
                  <Badge variant="secondary">
                    {STATUS_LABELS[idea.status as Status] ?? idea.status}
                  </Badge>
                  {idea.categoryName && (
                    <Badge variant="outline">{idea.categoryName}</Badge>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {idea.pitch}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{idea.ownerName}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {idea.memberCount}/{TEAM_SIZE_LABELS[idea.teamSize]}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{idea.interestCount} interested</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{idea.reactionTotal} reactions</span>
                </div>
              </div>

              <div className="flex items-center gap-2 md:justify-end">
                <Button
                  variant={idea.userVoted ? "default" : "outline"}
                  className="w-28 gap-2"
                  onClick={() => handleVote(idea)}
                  disabled={pendingIdeaId === idea._id}
                >
                  {pendingIdeaId === idea._id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : idea.userVoted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Vote className="h-4 w-4" />
                  )}
                  {idea.userVoted ? "Voted" : "Vote"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Toaster />
    </div>
  );
}
