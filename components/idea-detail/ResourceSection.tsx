"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProductViewer } from "@/components/ProductLayoutClient";
import { toast } from "sonner";
import type { IdeaDetail } from "@/lib/types";

export function ResourceSection({ idea }: { idea: IdeaDetail }) {
  const viewer = useProductViewer();
  const resources = useQuery(api.resources.list);
  const addMutation = useMutation(api.resourceRequests.add);
  const resolveMutation = useMutation(api.resourceRequests.resolve);
  const unresolveMutation = useMutation(api.resourceRequests.unresolve);
  const removeMutation = useMutation(api.resourceRequests.remove);
  const [resourceTag, setResourceTag] = useState("");
  const [resourceNotes, setResourceNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const canManageResources = idea.isOwner || Boolean(viewer?.isAdmin);

  const handleAddResource = async () => {
    if (!resourceTag) return;

    setIsAdding(true);
    try {
      await addMutation({
        ideaId: idea._id,
        tag: resourceTag,
        notes: resourceNotes.trim() || undefined,
      });
      setResourceTag("");
      setResourceNotes("");
      toast.success("Resource added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add resource",
      );
    } finally {
      setIsAdding(false);
    }
  };

  if (idea.resourceRequests.length === 0 && !canManageResources) return null;

  const unresolved = idea.resourceRequests.filter((r) => !r.resolved).length;

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mb-4">
        Resources{unresolved > 0 ? ` · ${unresolved} unresolved` : ""}
      </p>

      {canManageResources && resources && resources.length > 0 && (
        <div className="mb-5 pb-5 border-b border-border/50">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
            <Select value={resourceTag} onValueChange={setResourceTag}>
              <SelectTrigger>
                <SelectValue placeholder="Select a resource" />
              </SelectTrigger>
              <SelectContent>
                {resources.map((resource) => (
                  <SelectItem key={resource._id} value={resource.slug}>
                    {resource.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Optional notes"
              value={resourceNotes}
              onChange={(e) => setResourceNotes(e.target.value)}
              maxLength={1000}
            />
            <Button
              onClick={() => void handleAddResource()}
              disabled={isAdding || !resourceTag}
              size="sm"
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-0">
        {idea.resourceRequests.map((req) => (
          <div
            key={req._id}
            className="flex items-center justify-between gap-3 text-sm py-2 border-b border-border/30 last:border-0"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {req.resolved ? (
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 text-red-400 shrink-0" />
              )}
              <span
                className={
                  req.resolved
                    ? "line-through text-muted-foreground"
                    : ""
                }
              >
                {req.resourceName}
              </span>
              {req.notes && (
                <span className="text-xs text-muted-foreground/70 truncate">
                  — {req.notes}
                </span>
              )}
            </div>
            {canManageResources && (
              <div className="flex gap-1 shrink-0">
                {req.resolved ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      void unresolveMutation({ requestId: req._id })
                    }
                  >
                    Reopen
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => void resolveMutation({ requestId: req._id })}
                  >
                    Resolve
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive"
                  onClick={() => void removeMutation({ requestId: req._id })}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
