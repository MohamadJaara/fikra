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
import {
  useProductBase,
  useSelectedHackathon,
} from "@/components/ProductLayoutClient";

export default function EditIdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = useParamsSync(params);
  const hackathon = useSelectedHackathon();
  const productBase = useProductBase();
  const idea = useQuery(api.ideas.get, {
    ideaId: id as Id<"ideas">,
    hackathonId: hackathon?._id,
  });
  const updateMutation = useMutation(api.ideas.update);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (idea === undefined) {
    return (
      <div className="px-4 md:px-8 max-w-3xl mx-auto pb-16">
        <div className="h-1 rounded-full bg-foreground/20 mb-8" />
        <div className="text-center py-16 text-muted-foreground animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  if (idea === null) {
    return (
      <div className="px-4 md:px-8 max-w-3xl mx-auto pb-16">
        <div className="h-1 rounded-full bg-foreground/20 mb-8" />
        <div className="text-center py-16">
          <p className="text-lg font-medium mb-2">Idea not found</p>
          <Link
            href={productBase}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
        teamSize: data.teamSize,
        status: data.status,
        lookingForRoles: data.lookingForRoles,
        categoryId: data.categoryId as Id<"categories">,
        onsiteOnly: data.onsiteOnly,
      });
      toast.success("Idea updated!");
      router.push(`${productBase}/ideas/${id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update idea",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 md:px-8 max-w-3xl mx-auto pb-16">
      <div className="h-1 rounded-full bg-foreground/20 mb-8 animate-line-grow" />

      <div className="mb-10 animate-fade-in">
        <Link
          href={`${productBase}/ideas/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to Idea
        </Link>
      </div>

      <header className="mb-10 animate-reveal-up stagger-1">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          Edit Idea
        </h1>
        <p className="text-base text-muted-foreground">
          Update the details of your idea
        </p>
      </header>

      <div className="animate-reveal-up stagger-2">
        <IdeaForm
          initialData={{
            title: idea.title,
            pitch: idea.pitch,
            problem: idea.problem,
            targetAudience: idea.targetAudience,
            skillsNeeded: idea.skillsNeeded,
            teamSize: idea.teamSize,
            status: idea.status,
            lookingForRoles: idea.lookingForRoles,
            categoryId: idea.categoryId ?? "",
            onsiteOnly: idea.onsiteOnly,
          }}
          onSubmit={handleSubmit}
          isEditing
          isSubmitting={isSubmitting}
        />
      </div>

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
