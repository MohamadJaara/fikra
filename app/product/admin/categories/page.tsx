"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  PlusCircle,
  Trash2,
  Loader2,
  Tags,
  Pencil,
  X,
  ImageIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export default function AdminCategoriesPage() {
  const categories = useQuery(api.categories.list);
  const createMutation = useMutation(api.categories.create);
  const updateMutation = useMutation(api.categories.update);
  const deleteMutation = useMutation(api.categories.remove);
  const generateUploadUrl = useMutation(api.categories.generateUploadUrl);
  const [input, setInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"categories"> | null>(null);
  const [editingId, setEditingId] = useState<Id<"categories"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageId, setEditImageId] = useState<Id<"_storage"> | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const revokePreviewUrl = (url: string | null) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    return () => {
      revokePreviewUrl(editImageUrl);
    };
  }, [editImageUrl]);

  const clearSelectedImage = () => {
    revokePreviewUrl(editImageUrl);
    setEditImageFile(null);
    setEditImageUrl(null);
    resetFileInput();
  };

  const stopEditing = () => {
    clearSelectedImage();
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    setEditImageId(null);
  };

  const handleDelete = async (id: Id<"categories">, name: string) => {
    if (
      !confirm(
        `Delete "${name}"? Ideas using it will become uncategorized.`,
      )
    )
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

  const startEditing = (
    cat: { _id: Id<"categories">; name: string; description?: string; imageId?: Id<"_storage"> },
  ) => {
    clearSelectedImage();
    setEditingId(cat._id);
    setEditName(cat.name);
    setEditDescription(cat.description || "");
    setEditImageId(cat.imageId || null);
  };

  const handleImageSelection = (file: File) => {
    clearSelectedImage();
    setEditImageFile(file);
    setEditImageUrl(URL.createObjectURL(file));
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setIsSaving(true);
    let uploadedImageId: Id<"_storage"> | null = null;
    try {
      let nextImageId = editImageId || undefined;

      if (editImageFile) {
        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": editImageFile.type },
          body: editImageFile,
        });

        if (!result.ok) {
          throw new Error("Failed to upload image");
        }

        const { storageId } = await result.json();
        uploadedImageId = storageId as Id<"_storage">;
        nextImageId = uploadedImageId;
      }

      await updateMutation({
        categoryId: editingId,
        name: editName,
        description: editDescription || undefined,
        imageId: nextImageId,
      });
      toast.success("Category updated");
      stopEditing();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setIsSaving(false);
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
            {categories.length} categories &middot; Themes shown on main page
          </p>
        </div>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!input.trim()) return;
          setIsCreating(true);
          try {
            await createMutation({ name: input.trim() });
            toast.success(`Added ${input.trim()}`);
            setInput("");
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Failed to create",
            );
          } finally {
            setIsCreating(false);
          }
        }}
        className="flex gap-2"
      >
        <Input
          placeholder="Category name (e.g. AI/ML, Mobile, DevTools)"
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

      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No categories yet. Add some above, then edit to add descriptions and
          images.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {categories.map((cat) =>
                editingId === cat._id ? (
                  <div key={cat._id} className="p-4 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Edit Category</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Category name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="What problem domain does this theme cover?"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Image</Label>
                      <div className="flex items-center gap-3">
                        {editImageUrl && (
                          <div className="h-16 w-24 rounded bg-muted overflow-hidden">
                            <img
                              src={editImageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageSelection(file);
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <ImageIcon className="h-3 w-3 mr-1" />
                            {editImageId || cat.imageId
                              ? "Change Image"
                              : "Upload Image"}
                          </Button>
                          {(editImageId || cat.imageId) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="ml-2 text-xs text-destructive"
                              onClick={() => {
                                clearSelectedImage();
                                setEditImageId(null);
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={isSaving || !editName.trim()}
                      >
                        {isSaving && (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        )}
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={stopEditing}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={cat._id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-sm">{cat.name}</span>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {cat.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => startEditing(cat)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
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
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Toaster />
    </div>
  );
}
