"use client";

import { IdeaForm, type IdeaFormData } from "@/components/IdeaForm";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";

export default function EditIdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = useParamsSync(params);
  const idea = useQuery(api.ideas.get, { ideaId: id as Id<"ideas"> });
  const updateMutation = useMutation(api.ideas.update);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (idea === undefined) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  if (idea === null) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="text-center py-12">
          <p className="text-lg font-medium">Idea not found</p>
          <Link
            href="/product"
            className="text-sm text-muted-foreground hover:text-primary mt-2 inline-block"
          >
            Back to Browse
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (data: IdeaFormData) => {
    setIsSubmitting(true);
    try {
      await updateMutation({
        ideaId: id as Id<"ideas">,
        title: data.title,
        pitch: data.pitch,
        problem: data.problem,
        targetAudience: data.targetAudience,
        skillsNeeded: data.skillsNeeded,
        teamSizeWanted: data.teamSizeWanted,
        status: data.status,
        lookingForRoles: data.lookingForRoles,
        categoryId: data.categoryId as any,
        onsiteOnly: data.onsiteOnly,
      });
      toast.success("Idea updated!");
      router.push(`/product/ideas/${id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update idea",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href={`/product/ideas/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Idea
      </Link>

      <h1 className="text-2xl font-bold mb-6">Edit Idea</h1>

      <IdeaForm
        initialData={{
          title: idea.title,
          pitch: idea.pitch,
          problem: idea.problem,
          targetAudience: idea.targetAudience,
          skillsNeeded: idea.skillsNeeded,
          teamSizeWanted: idea.teamSizeWanted,
          status: idea.status,
          lookingForRoles: idea.lookingForRoles,
          categoryId: idea.categoryId ?? "",
          onsiteOnly: idea.onsiteOnly,
        }}
        onSubmit={handleSubmit}
        isEditing
        isSubmitting={isSubmitting}
      />

      <Toaster />
    </div>
  );
}

function useParamsSync(params: Promise<{ id: string }>) {
  const [resolved, setResolved] = useState<{ id: string } | null>(null);
  if (resolved === null) {
    params.then(setResolved);
    return { id: "" };
  }
  return resolved;
}
