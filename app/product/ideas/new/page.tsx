"use client";

import { IdeaForm, type IdeaFormData } from "@/components/IdeaForm";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateIdeaPage() {
  const createMutation = useMutation(api.ideas.create);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: IdeaFormData) => {
    setIsSubmitting(true);
    try {
      const ideaId = await createMutation({
        title: data.title,
        pitch: data.pitch,
        problem: data.problem,
        targetAudience: data.targetAudience,
        skillsNeeded: data.skillsNeeded,
        teamSizeWanted: data.teamSizeWanted,
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
      <Link
        href="/product"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Browse
      </Link>

      <h1 className="text-2xl font-bold mb-6">Create a New Idea</h1>

      <IdeaForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />

      <Toaster />
    </div>
  );
}
