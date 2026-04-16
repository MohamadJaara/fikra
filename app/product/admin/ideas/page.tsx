"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Search, Lightbulb, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { toast, Toaster } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { STATUSES, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import type { Status } from "@/lib/constants";
import { useRolesMap } from "@/lib/hooks";

export default function AdminIdeasPage() {
  const ideas = useQuery(api.admin.listIdeas);
  const deleteIdea = useMutation(api.admin.deleteIdea);
  const updateIdeaStatus = useMutation(api.admin.updateIdeaStatus);
  const roleLabels = useRolesMap();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!ideas) return [];
    if (!search.trim()) return ideas;
    const q = search.toLowerCase();
    return ideas.filter(
      (idea: any) =>
        idea.title.toLowerCase().includes(q) ||
        idea.ownerName.toLowerCase().includes(q) ||
        idea.ownerEmail?.toLowerCase().includes(q),
    );
  }, [ideas, search]);

  const handleDelete = async (ideaId: Id<"ideas">, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteIdea({ ideaId });
      toast.success(`Deleted "${title}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  const handleStatusChange = async (ideaId: Id<"ideas">, status: Status) => {
    try {
      await updateIdeaStatus({ ideaId, status });
      toast.success("Status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
  };

  if (ideas === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading ideas...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/product/admin"
          className="text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6" />
            Ideas
          </h1>
          <p className="text-sm text-muted-foreground">
            {ideas.length} ideas submitted
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title or owner..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Idea</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Reactions</TableHead>
                <TableHead>Comments</TableHead>
                <TableHead>Missing Roles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {search ? "No ideas match your search" : "No ideas found"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((idea: any) => (
                  <TableRow key={idea._id}>
                    <TableCell>
                      <Link
                        href={`/product/ideas/${idea._id}`}
                        className="font-medium text-sm hover:underline"
                      >
                        {idea.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {new Date(idea._creationTime).toLocaleDateString()}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{idea.ownerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {idea.ownerEmail}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={idea.status}
                        onValueChange={(v) =>
                          handleStatusChange(idea._id, v as Status)
                        }
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              <Badge
                                variant="outline"
                                className={STATUS_COLORS[s]}
                              >
                                {STATUS_LABELS[s]}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">
                      {idea.memberCount}/{idea.teamSizeWanted}
                    </TableCell>
                    <TableCell className="text-sm">
                      {idea.reactionCount}
                    </TableCell>
                    <TableCell className="text-sm">
                      {idea.commentCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {idea.lookingForRoles.map((role: string) => (
                          <Badge
                            key={role}
                            variant="secondary"
                            className="text-xs"
                          >
                            {roleLabels[role] || role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(idea._id, idea.title)}
                        className="text-xs"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Toaster />
    </div>
  );
}
