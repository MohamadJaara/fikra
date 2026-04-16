"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, PlusCircle, Trash2, Loader2, Tags } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export default function AdminCategoriesPage() {
  const categories = useQuery(api.categories.list);
  const createMutation = useMutation(api.categories.create);
  const deleteMutation = useMutation(api.categories.remove);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"categories"> | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      await createMutation({ name: newName.trim() });
      setNewName("");
      toast.success("Category created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: Id<"categories">, name: string) => {
    if (!confirm(`Delete "${name}"? Ideas using it will become uncategorized.`))
      return;
    setDeletingId(id);
    try {
      await deleteMutation({ categoryId: id });
      toast.success("Category deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  if (categories === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading categories...</div>
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
            <Tags className="h-6 w-6" />
            Categories
          </h1>
          <p className="text-sm text-muted-foreground">
            {categories.length} categories
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={60}
          className="flex-1"
        />
        <Button type="submit" disabled={isCreating || !newName.trim()}>
          {isCreating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <PlusCircle className="h-4 w-4 mr-2" />
          )}
          Add
        </Button>
      </form>

      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No categories yet. Add one above.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {categories.map((cat) => (
                <div
                  key={cat._id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <span className="font-medium text-sm">{cat.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:text-destructive"
                    disabled={deletingId === cat._id}
                    onClick={() => handleDelete(cat._id, cat.name)}
                  >
                    {deletingId === cat._id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3 mr-1" />
                    )}
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Toaster />
    </div>
  );
}
