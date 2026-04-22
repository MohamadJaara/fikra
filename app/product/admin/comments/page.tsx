"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, ArrowLeft, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { toast, Toaster } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export default function AdminCommentsPage() {
  const comments = useQuery(api.admin.listComments);
  const deleteComment = useMutation(api.admin.deleteComment);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!comments) return [];
    if (!search.trim()) return comments;
    const q = search.toLowerCase();
    return comments.filter(
      (c: { content: string; authorName: string; ideaTitle: string }) =>
        c.content.toLowerCase().includes(q) ||
        c.authorName.toLowerCase().includes(q) ||
        c.ideaTitle.toLowerCase().includes(q),
    );
  }, [comments, search]);

  const handleDelete = async (commentId: Id<"comments">) => {
    if (!confirm("Delete this comment and all its replies?")) return;
    try {
      await deleteComment({ commentId });
      toast.success("Comment deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  if (comments === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading comments...</div>
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
            <MessageSquare className="h-6 w-6" />
            Comments
          </h1>
          <p className="text-sm text-muted-foreground">
            {comments.length} comments across all ideas
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search comments..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comment</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Idea</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {search
                      ? "No comments match your search"
                      : "No comments found"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((comment: any) => (
                  <TableRow key={comment._id}>
                    <TableCell className="max-w-xs">
                      <p className="text-sm line-clamp-2">{comment.content}</p>
                      {comment.parentId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Reply
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{comment.authorName}</p>
                      <p className="text-xs text-muted-foreground">
                        {comment.authorEmail}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/product/ideas/${comment.ideaId}`}
                        className="text-sm text-primary hover:underline line-clamp-1"
                      >
                        {comment.ideaTitle}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(comment._creationTime).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(comment._id)}
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
      </div>

      <Toaster />
    </div>
  );
}
