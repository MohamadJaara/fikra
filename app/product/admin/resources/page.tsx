"use client";

import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Loader2,
  Package,
  PlusCircle,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast, Toaster } from "sonner";

export default function AdminResourcesPage() {
  const resources = useQuery(api.resources.list);
  const createManyMutation = useMutation(api.resources.createMany);
  const deleteMutation = useMutation(api.resources.remove);
  const [input, setInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"resources"> | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsCreating(true);
    try {
      const result = await createManyMutation({ names: input });
      const parts: string[] = [];
      if (result.created.length > 0) {
        parts.push(`Added ${result.created.join(", ")}`);
      }
      if (result.skipped.length > 0) {
        parts.push(`Skipped (exist): ${result.skipped.join(", ")}`);
      }
      toast.success(parts.join(". "));
      setInput("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: Id<"resources">, name: string) => {
    if (!confirm(`Delete "${name}"? Existing requests will keep their label.`)) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteMutation({ resourceId: id });
      toast.success("Resource deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  if (resources === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading resources...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/product/admin"
          className="text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Resources
          </h1>
          <p className="text-sm text-muted-foreground">
            {resources.length} resources
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          placeholder="e.g. Linux VPS, Design Help, Mentoring (comma-separated)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={isCreating || !input.trim()}>
          {isCreating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <PlusCircle className="h-4 w-4 mr-2" />
          )}
          Add
        </Button>
      </form>

      {resources.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No resources yet. Add some above.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="divide-y">
              {resources.map((resource) => (
                <div
                  key={resource._id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <span className="font-medium text-sm">{resource.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:text-destructive"
                    disabled={deletingId === resource._id}
                    onClick={() => handleDelete(resource._id, resource.name)}
                  >
                    {deletingId === resource._id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3 mr-1" />
                    )}
                    Delete
                  </Button>
                </div>
              ))}
            </div>
        </div>
      )}

      <Toaster />
    </div>
  );
}
