"use client";

import { IdeaForm, type IdeaFormData } from "@/components/IdeaForm";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Lightbulb } from "lucide-react";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

export default function CreateIdeaPage() {
  const createMutation = useMutation(api.ideas.create);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const preselectedCategoryId = searchParams.get("categoryId") || undefined;
  const categories = useQuery(api.categories.list);
  const selectedCategory = categories?.find(
    (c) => c._id === preselectedCategoryId,
  );

  const handleSubmit = async (data: IdeaFormData) => {
    setIsSubmitting(true);
    try {
      const ideaId = await createMutation({
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

      <div className="animate-reveal-up stagger-2">
        <IdeaForm
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          initialCategoryId={preselectedCategoryId}
        />
      </div>

      <Toaster />
    </div>
  );
}
