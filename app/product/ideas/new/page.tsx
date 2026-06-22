"use client";

import { IdeaForm, type IdeaFormData } from "@/components/IdeaForm";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import {
  ArrowLeft,
  CalendarX2,
  Clock3,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";
import { useSelectedHackathon } from "@/components/ProductLayoutClient";

function formatDeadline(deadlineAt: number | null, timezone: string | null) {
  if (!deadlineAt) return null;

  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone ?? undefined,
      timeZoneName: "short",
    }).format(new Date(deadlineAt));
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(deadlineAt));
  }
}

export default function CreateIdeaPage() {
  const createMutation = useMutation(api.ideas.create);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hackathon = useSelectedHackathon();
  const submissionStatus = useQuery(api.ideaSubmissions.getCurrent, {
    hackathonId: hackathon?._id,
  });

  const preselectedCategoryId = searchParams.get("categoryId") || undefined;
  const categories = useQuery(api.categories.list, {
    hackathonId: hackathon?._id,
  });
  const selectedCategory = categories?.find(
    (c) => c._id === preselectedCategoryId,
  );

  const handleSubmit = async (data: IdeaFormData) => {
    if (submissionStatus && !submissionStatus.isOpen) {
      toast.error(submissionStatus.message ?? "Idea submissions are closed");
      return;
    }

    setIsSubmitting(true);
    try {
      const ideaId = await createMutation({
        hackathonId: hackathon?._id,
        title: data.title,
        pitch: data.pitch,
        problem: data.problem,
        targetAudience: data.targetAudience,
        skillsNeeded: data.skillsNeeded,
        teamSize: data.teamSize,
        status: data.status,
        lookingForRoles: data.lookingForRoles,
        resourceTags: data.resourceTags,
        resourceNotes: data.resourceNotes,
        categoryId: data.categoryId as Id<"categories">,
        onsiteOnly: data.onsiteOnly,
      });
      toast.success("Idea created!");
      router.push(`/product/ideas/${ideaId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create idea",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const deadlineLabel =
    submissionStatus && !submissionStatus.isOpen
      ? formatDeadline(submissionStatus.deadlineAt, submissionStatus.timezone)
      : null;

  return (
    <div className="px-4 md:px-8 max-w-3xl mx-auto pb-16">
      <div className="h-1 rounded-full bg-foreground/20 mb-8 animate-line-grow" />

      <div className="mb-10 animate-fade-in">
        {selectedCategory ? (
          <Link
            href={`/product/categories/${selectedCategory.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            {selectedCategory.name}
          </Link>
        ) : (
          <Link
            href="/product"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Browse
          </Link>
        )}
      </div>

      <header className="mb-10 animate-reveal-up stagger-1">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          New Idea
        </h1>
        {selectedCategory ? (
          <p className="text-base text-muted-foreground flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Under{" "}
            <span className="text-foreground font-medium">
              {selectedCategory.name}
            </span>
            {selectedCategory.description &&
              ` — ${selectedCategory.description}`}
          </p>
        ) : (
          <p className="text-base text-muted-foreground">
            Describe your idea and what problem it solves
          </p>
        )}
      </header>

      {submissionStatus === undefined ? (
        <div className="animate-reveal-up stagger-2 flex items-center gap-3 rounded-lg border bg-background px-4 py-4 text-sm text-muted-foreground">
          <Clock3 className="h-4 w-4 animate-pulse" />
          Checking the submission window...
        </div>
      ) : submissionStatus.isOpen ? (
        <div className="animate-reveal-up stagger-2">
          <IdeaForm
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            initialCategoryId={preselectedCategoryId}
          />
        </div>
      ) : (
        <div className="animate-reveal-up stagger-2 overflow-hidden rounded-lg border bg-background shadow-sm">
          <div className="h-2 bg-[repeating-linear-gradient(135deg,hsl(var(--foreground))_0,hsl(var(--foreground))_10px,transparent_10px,transparent_20px)] opacity-80" />
          <div className="space-y-6 p-6 md:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
                <CalendarX2 className="h-7 w-7" />
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Submission Window
                </p>
                <h2 className="text-2xl font-bold tracking-tight">
                  Idea submissions are closed
                </h2>
                {deadlineLabel && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    Deadline was {deadlineLabel}
                  </p>
                )}
              </div>
            </div>

            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              {submissionStatus.message}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/product/discover">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Find a team
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/product/ideas">
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Browse ideas
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  );
}
