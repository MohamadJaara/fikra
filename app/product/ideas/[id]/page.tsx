"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { use, useEffect, Suspense } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
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
  const idea = useQuery(api.ideas.get, { ideaId });
  const comments = useQuery(api.comments.list, { ideaId });
  const searchParams = useSearchParams();
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
        <div className="text-center py-12">
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

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/product"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
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

      <div className="space-y-6 animate-fade-in">
        <IdeaHeader idea={idea} />
        {idea.isOwner && (
          <OwnerWelcomeBanner key={idea._id} ideaId={idea._id} />
        )}
        <OwnershipTransferRequestBanner idea={idea} />
        <IdeaContent idea={idea} />
        <RoomSection idea={idea} />
        <Separator />
        <div className="space-y-8">
          <section id="team" className="scroll-mt-24">
            <TeamSection idea={idea} ideaId={ideaId} />
          </section>

          <Separator />

          <section id="resources" className="scroll-mt-24">
            <ResourceSection idea={idea} />
          </section>

          <Separator />

          <section id="reactions" className="scroll-mt-24">
            <ReactionSection idea={idea} ideaId={ideaId} />
          </section>

          <Separator />

          <section id="interest" className="scroll-mt-24">
            <InterestSection idea={idea} ideaId={ideaId} />
          </section>

          <Separator />

          <section id="related" className="scroll-mt-24">
            <RelatedIdeasSection ideaId={ideaId} isOwner={idea.isOwner} />
          </section>

          <Separator />

          <section id="comments" className="scroll-mt-24">
            <CommentSection
              comments={comments}
              ideaId={ideaId}
              isOwner={idea.isOwner}
            />
          </section>
        </div>
      </div>

      <Toaster />
    </div>
  );
}
