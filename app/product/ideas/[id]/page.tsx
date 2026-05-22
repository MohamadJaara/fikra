"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { use, useEffect, useMemo, Suspense } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BookmarkButton } from "@/components/BookmarkButton";
import { OwnerWelcomeBanner } from "@/components/OwnerWelcomeBanner";
import { IdeaDetailSkeleton } from "@/components/Skeleton";
import { Toaster } from "sonner";
import { IdeaHeader } from "@/components/idea-detail/IdeaHeader";
import { OwnershipTransferRequestBanner } from "@/components/idea-detail/OwnershipTransferRequestBanner";
import { IdeaContent } from "@/components/idea-detail/IdeaContent";
import { RoomSection } from "@/components/idea-detail/RoomSection";
import { TeamSection } from "@/components/idea-detail/TeamSection";
import { ResourceSection } from "@/components/idea-detail/ResourceSection";
import { ReactionSection } from "@/components/idea-detail/ReactionSection";
import { InterestSection } from "@/components/idea-detail/InterestSection";
import { RelatedIdeasSection } from "@/components/idea-detail/RelatedIdeasSection";
import { CommentSection } from "@/components/idea-detail/CommentSection";
import { OwnerActions } from "@/components/idea-detail/OwnerActions";
import { IdeaNavigation } from "@/components/idea-detail/IdeaNavigation";
import { STATUS_DOT_COLORS, type Status } from "@/lib/constants";
import type { SortOption } from "@/lib/constants";

function splitParam(value: string | null) {
  return value?.split(",").filter(Boolean);
}

export default function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          <IdeaDetailSkeleton />
        </div>
      }
    >
      <IdeaDetailContent params={params} />
    </Suspense>
  );
}

function IdeaDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ideaId = id as Id<"ideas">;
  const searchParams = useSearchParams();
  const navigationParams = new URLSearchParams(searchParams.toString());
  navigationParams.delete("comment");
  const browseQuery = navigationParams.toString();
  const sortBy = (searchParams.get("sort") as SortOption) || "most_interest";
  const navigationFilters = useMemo(
    () => ({
      search: searchParams.get("search") || undefined,
      statuses: splitParam(searchParams.get("statuses")),
      roles: splitParam(searchParams.get("roles")),
      resourceTags: splitParam(searchParams.get("resourceTags")),
      categories: splitParam(searchParams.get("categories")) as
        | Array<Id<"categories"> | "__none__">
        | undefined,
      needsTeammates: searchParams.get("needsTeammates") === "1" || undefined,
      needsResources: searchParams.get("needsResources") === "1" || undefined,
    }),
    [searchParams],
  );
  const idea = useQuery(api.ideas.get, { ideaId });
  const navigation = useQuery(api.ideas.getAdjacent, {
    ideaId,
    filters: navigationFilters,
    sortBy,
  });
  const comments = useQuery(api.comments.list, { ideaId });
  const commentId = searchParams.get("comment");

  useEffect(() => {
    if (!commentId || !comments) return;
    const el = document.getElementById(`comment-${commentId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/30", "rounded-lg");
      const timeoutId = setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary/30", "rounded-lg");
      }, 3000);
      return () => clearTimeout(timeoutId);
    }
  }, [commentId, comments]);

  if (idea === undefined || comments === undefined) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <IdeaDetailSkeleton />
      </div>
    );
  }

  if (idea === null) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="text-center py-20">
          <p className="text-lg font-medium mb-2">Idea not found</p>
          <Link
            href="/product"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            Back to Browse
          </Link>
        </div>
      </div>
    );
  }

  const statusColor = STATUS_DOT_COLORS[idea.status as Status] || "bg-muted";

  return (
    <div className="px-4 md:px-8 max-w-4xl mx-auto pb-16">
      <div
        className={`h-1 rounded-full ${statusColor} mb-8 animate-line-grow`}
      />

      <div className="flex items-center justify-between mb-4 animate-fade-in">
        <Link
          href={browseQuery ? `/product/ideas?${browseQuery}` : "/product/ideas"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Browse
        </Link>
        <div className="flex items-center gap-2">
          {!idea.isOwner && (
            <BookmarkButton
              ideaId={idea._id}
              isBookmarked={idea.isBookmarked}
              size="md"
            />
          )}
          {idea.isOwner && <OwnerActions idea={idea} />}
        </div>
      </div>

      <div className="animate-reveal-up stagger-1">
        <IdeaNavigation navigation={navigation} query={browseQuery} />
      </div>

      <div className="animate-reveal-up stagger-2">
        <IdeaHeader idea={idea} />
      </div>

      <div className="animate-reveal-up stagger-3">
        {idea.isOwner && (
          <OwnerWelcomeBanner key={idea._id} ideaId={idea._id} />
        )}
        <OwnershipTransferRequestBanner idea={idea} />
      </div>

      <div className="animate-reveal-up stagger-4">
        <IdeaContent idea={idea} />
      </div>

      <div className="animate-reveal-up stagger-5">
        <RoomSection idea={idea} />
      </div>

      <div className="py-6 my-2 border-t animate-reveal-up stagger-6">
        <section id="reactions" className="scroll-mt-24">
          <ReactionSection idea={idea} ideaId={ideaId} />
        </section>
      </div>

      <div className="space-y-10">
        <section id="team" className="scroll-mt-24 animate-reveal-up stagger-6">
          <TeamSection idea={idea} ideaId={ideaId} />
        </section>

        <section
          id="resources"
          className="scroll-mt-24 animate-reveal-up stagger-7"
        >
          <ResourceSection idea={idea} />
        </section>

        <section
          id="interest"
          className="scroll-mt-24 animate-reveal-up stagger-7"
        >
          <InterestSection idea={idea} ideaId={ideaId} />
        </section>

        <section
          id="related"
          className="scroll-mt-24 animate-reveal-up stagger-8"
        >
          <RelatedIdeasSection ideaId={ideaId} isOwner={idea.isOwner} />
        </section>

        <section
          id="comments"
          className="scroll-mt-24 animate-reveal-up stagger-9"
        >
          <CommentSection
            comments={comments}
            ideaId={ideaId}
            isOwner={idea.isOwner}
          />
        </section>
      </div>

      <Toaster />
    </div>
  );
}
