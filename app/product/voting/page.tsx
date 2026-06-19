"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { STATUS_LABELS, TEAM_SIZE_LABELS, type Status } from "@/lib/constants";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Check,
  Clock3,
  Loader2,
  Search,
  Users,
  Vote,
} from "lucide-react";
import Link from "next/link";
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
  const status = useQuery(api.voting.status);
  const ballot = useQuery(api.voting.ballot);
  const toggleVote = useMutation(api.voting.toggleVote);
  const [query, setQuery] = useState("");
  const [pendingIdeaId, setPendingIdeaId] = useState<Id<"ideas"> | null>(null);

  const ideas = useMemo(() => (ballot ?? []) as BallotIdea[], [ballot]);
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
      const result = await toggleVote({ ideaId: idea._id });
      toast.success(result.voted ? "Vote added" : "Vote removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Vote failed");
    } finally {
      setPendingIdeaId(null);
    }
  };

  if (status === undefined || ballot === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status.active) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border bg-muted/40">
          <Clock3 className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Voting has not started</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Once an admin opens voting, the active idea board will appear here.
          Results stay private to admins.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/product/ideas">Browse ideas</Link>
        </Button>
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
            changed while voting is open.
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
                  <Link
                    href={`/product/ideas/${idea._id}`}
                    className="text-base font-semibold transition-colors hover:text-primary"
                  >
                    {idea.title}
                  </Link>
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
                <Button asChild variant="ghost" size="icon">
                  <Link
                    href={`/product/ideas/${idea._id}`}
                    aria-label={`Open ${idea.title}`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
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
