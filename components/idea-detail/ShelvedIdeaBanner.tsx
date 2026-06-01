"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Archive, ArrowRightLeft, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import type { IdeaDetail } from "@/lib/types";
import { toast } from "sonner";

export function ShelvedIdeaBanner({ idea }: { idea: IdeaDetail }) {
  const requestOwnership = useMutation(api.ideas.requestOwnership);
  const [isRequesting, setIsRequesting] = useState(false);

  if (idea.status !== "shelved") return null;

  const handleRequestOwnership = async () => {
    setIsRequesting(true);
    try {
      await requestOwnership({ ideaId: idea._id });
      toast.success("Ownership request sent to the owner");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to request ownership",
      );
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="mb-6 rounded-lg border border-stone-200 bg-stone-50/80 p-4 dark:border-stone-800 dark:bg-stone-950/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200">
            <Archive className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
              Needs new owner
            </p>
            <p className="mt-1 text-sm leading-6 text-stone-700 dark:text-stone-300">
              This idea is shelved by its owner. It stays visible so someone
              else can pick it up and lead it.
            </p>
          </div>
        </div>

        {!idea.isOwner && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-stone-300 bg-background dark:border-stone-700"
            onClick={() => void handleRequestOwnership()}
            disabled={isRequesting || idea.hasPendingOwnershipTransfer}
          >
            {isRequesting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-4 w-4 mr-1" />
            )}
            {idea.hasPendingOwnershipTransfer
              ? "Ownership pending"
              : "Request ownership"}
          </Button>
        )}
      </div>
    </div>
  );
}
