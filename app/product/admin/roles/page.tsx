"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, PlusCircle, Trash2, Loader2, Shield } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export default function AdminRolesPage() {
  const roles = useQuery(api.roles.list);
  const createManyMutation = useMutation(api.roles.createMany);
  const deleteMutation = useMutation(api.roles.remove);
  const [input, setInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"roles"> | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setIsCreating(true);
    try {
      const result = await createManyMutation({ names: input });
      const parts: string[] = [];
      if (result.created.length > 0)
        parts.push(`Added ${result.created.join(", ")}`);
      if (result.skipped.length > 0)
        parts.push(`Skipped (exist): ${result.skipped.join(", ")}`);
      toast.success(parts.join(". "));
      setInput("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: Id<"roles">, name: string) => {
    if (
      !confirm(
        `Delete "${name}"? Users and ideas with this role will have it removed.`,
      )
    )
      return;
    setDeletingId(id);
    try {
      await deleteMutation({ roleId: id });
      toast.success("Role deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  if (roles === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading roles...</div>
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
            <Shield className="h-6 w-6" />
            Roles
          </h1>
          <p className="text-sm text-muted-foreground">{roles.length} roles</p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          placeholder="e.g. Frontend, Backend, Design, PM (comma-separated)"
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

      {roles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No roles yet. Add some above.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {roles.map((role) => (
                <div
                  key={role._id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <span className="font-medium text-sm">{role.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:text-destructive"
                    disabled={deletingId === role._id}
                    onClick={() => handleDelete(role._id, role.name)}
                  >
                    {deletingId === role._id ? (
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
