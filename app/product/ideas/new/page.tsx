"use client";

import { IdeaForm, type IdeaFormData } from "@/components/IdeaForm";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Lightbulb } from "lucide-react";
import Link from "next/link";

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
        categoryId: data.categoryId as any,
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
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {selectedCategory ? (
        <Link
          href={`/product/categories/${selectedCategory.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {selectedCategory.name}
        </Link>
      ) : (
        <Link
          href="/product"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Themes
        </Link>
      )}

      <h1 className="text-2xl font-bold mb-1">Create a New Idea</h1>
      {selectedCategory ? (
        <p className="text-sm text-muted-foreground mb-6 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
          Under{" "}
          <span className="font-medium text-foreground">
            {selectedCategory.name}
          </span>
          {selectedCategory.description &&
            ` — ${selectedCategory.description}`}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground mb-6">
          Describe your idea and what problem it solves
        </p>
      )}

      <IdeaForm
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        initialCategoryId={preselectedCategoryId}
      />

      <Toaster />
    </div>
  );
}
