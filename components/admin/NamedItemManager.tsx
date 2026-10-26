"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  PlusCircle,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NamedItemManagerProps<ItemId extends string> = {
  title: string;
  itemLabel: string;
  icon: LucideIcon;
  backHref: string;
  inputPlaceholder: string;
  items: readonly { _id: ItemId; name: string }[] | undefined;
  onCreate: (
    names: string,
  ) => Promise<{ created: string[]; skipped: string[] }>;
  onDelete: (id: ItemId) => Promise<unknown>;
  getDeleteConfirmation: (name: string) => string;
};

export function NamedItemManager<ItemId extends string>({
  title,
  itemLabel,
  icon: Icon,
  backHref,
  inputPlaceholder,
  items,
  onCreate,
  onDelete,
  getDeleteConfirmation,
}: NamedItemManagerProps<ItemId>) {
  const [input, setInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<ItemId | null>(null);
  const pluralLabel = title.toLowerCase();

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim()) return;
    setIsCreating(true);
    try {
      const result = await onCreate(input);
      const messages: string[] = [];
      if (result.created.length > 0) {
        messages.push(`Added ${result.created.join(", ")}`);
      }
      if (result.skipped.length > 0) {
        messages.push(`Skipped (exist): ${result.skipped.join(", ")}`);
      }
      toast.success(messages.join(". "));
      setInput("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: ItemId, name: string) => {
    if (!confirm(getDeleteConfirmation(name))) return;
    setDeletingId(id);
    try {
      await onDelete(id);
      toast.success(`${itemLabel} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  if (items === undefined) {
    return (
      <div className="flex items-center justify-center py-12" role="status">
        <div className="text-muted-foreground">Loading {pluralLabel}...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          aria-label="Back to admin"
          className="text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Icon className="h-6 w-6" />
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {items.length} {pluralLabel}
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          aria-label={`${title} to add`}
          placeholder={inputPlaceholder}
          value={input}
          onChange={(event) => setInput(event.target.value)}
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

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No {pluralLabel} yet. Add some above.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="divide-y">
            {items.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="font-medium text-sm">{item.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive"
                  disabled={deletingId !== null}
                  onClick={() => handleDelete(item._id, item.name)}
                >
                  {deletingId === item._id ? (
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
    </div>
  );
}
