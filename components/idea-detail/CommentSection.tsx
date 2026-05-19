"use client";

import { useState, useMemo, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  MessageSquare,
  Edit,
  Trash2,
  Reply,
  Send,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MentionTextarea,
  renderMentionContent,
} from "@/components/MentionTextarea";
import { UserAvatar, UserLink } from "@/components/UserLink";
import { FeatureTip } from "@/components/FeatureTip";
import { toast } from "sonner";
import type { CommentItem } from "@/lib/types";
import { timeAgo } from "./shared";

const QUICK_PROMPTS = [
  "What problem are you solving?",
  "What would an MVP look like?",
  "What help do you need?",
  "Any risks or blockers?",
];

export function CommentSection({
  comments,
  ideaId,
  isOwner,
}: {
  comments: CommentItem[] | undefined;
  ideaId: Id<"ideas">;
  isOwner: boolean;
}) {
  const createMutation = useMutation(api.comments.create);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topLevel = useMemo(
    () => (comments || []).filter((c) => !c.parentId),
    [comments],
  );
  const repliesByParent = useMemo(() => {
    const map = new Map<string, typeof comments>();
    for (const c of comments || []) {
      if (c.parentId) {
        const list = map.get(c.parentId) || [];
        list.push(c);
        map.set(c.parentId, list);
      }
    }
    return map;
  }, [comments]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!content.trim()) return;
      setIsSubmitting(true);
      createMutation({ ideaId, content: content.trim() })
        .then(() => setContent(""))
        .catch((error) =>
          toast.error(
            error instanceof Error ? error.message : "Failed to post",
          ),
        )
        .finally(() => setIsSubmitting(false));
    },
    [content, ideaId, createMutation],
  );

  return (
    <div>
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5" />
        Discussion ({comments?.length || 0})
      </h2>

      <form onSubmit={handleSubmit} className="mb-6 space-y-2">
        <FeatureTip tipKey="comment-mention">
          Type <strong>@</strong> in the comment box to mention a teammate —
          they&apos;ll get notified. Use the quick prompts above to kickstart
          the discussion.
        </FeatureTip>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              onClick={() => setContent(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="flex w-full items-end gap-2">
          <MentionTextarea
            value={content}
            onChange={setContent}
            onSubmit={() => void handleSubmit()}
            placeholder="Add a comment... (type @ to mention)"
            rows={2}
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !content.trim()}
            className="shrink-0"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>

      <div className="space-y-4">
        {topLevel.map((comment) => (
          <CommentItemComponent
            key={comment._id}
            comment={comment}
            replies={repliesByParent.get(comment._id) || []}
            ideaId={ideaId}
            isOwner={isOwner}
          />
        ))}
        {topLevel.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No comments yet. Start the discussion!
          </p>
        )}
      </div>
    </div>
  );
}

function ReplyItem({
  reply,
  isOwner,
}: {
  reply: CommentItem;
  isOwner: boolean;
}) {
  const updateMutation = useMutation(api.comments.update);
  const deleteMutation = useMutation(api.comments.remove);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEditSave = async () => {
    if (!editContent.trim()) return;
    setIsSaving(true);
    try {
      await updateMutation({
        commentId: reply._id as Id<"comments">,
        content: editContent.trim(),
      });
      setIsEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this reply?")) return;
    setIsDeleting(true);
    try {
      await deleteMutation({ commentId: reply._id as Id<"comments"> });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id={`comment-${reply._id}`} className="flex gap-2">
      <UserAvatar
        handle={reply.authorHandle}
        image={reply.authorImage}
        name={reply.authorName}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <UserLink
            handle={reply.authorHandle}
            name={reply.authorName}
            className="font-medium text-xs"
          />
          <span className="text-[11px] text-muted-foreground">
            {timeAgo(reply._creationTime)}
          </span>
        </div>
        {isEditing ? (
          <div className="mt-1 flex w-full items-end gap-2">
            <MentionTextarea
              value={editContent}
              onChange={setEditContent}
              placeholder="Edit reply... (type @ to mention)"
              rows={2}
              className="min-w-0 flex-1 text-sm"
              autoFocus
            />
            <div className="flex flex-col gap-1 self-end">
              <Button
                size="sm"
                disabled={isSaving || !editContent.trim()}
                onClick={handleEditSave}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditContent(reply.content);
                  setIsEditing(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm mt-0.5 whitespace-pre-wrap">
              {renderMentionContent(reply.content, reply.mentionedUsers)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {reply.isAuthor && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <Edit className="h-3 w-3" />
                  Edit
                </button>
              )}
              {(reply.isAuthor || isOwner) && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CommentItemComponent({
  comment,
  replies,
  ideaId,
  isOwner,
}: {
  comment: CommentItem;
  replies: CommentItem[];
  ideaId: Id<"ideas">;
  isOwner: boolean;
}) {
  const createMutation = useMutation(api.comments.create);
  const updateMutation = useMutation(api.comments.update);
  const deleteMutation = useMutation(api.comments.remove);
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleReply = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!replyContent.trim()) return;
    setIsSubmitting(true);
    try {
      await createMutation({
        ideaId,
        content: replyContent.trim(),
        parentId: comment._id as Id<"comments">,
      });
      setReplyContent("");
      setShowReply(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSave = async () => {
    if (!editContent.trim()) return;
    setIsSaving(true);
    try {
      await updateMutation({
        commentId: comment._id as Id<"comments">,
        content: editContent.trim(),
      });
      setIsEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this comment?")) return;
    setIsDeleting(true);
    try {
      await deleteMutation({ commentId: comment._id as Id<"comments"> });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id={`comment-${comment._id}`}>
      <div className="flex gap-2">
        <UserAvatar
          handle={comment.authorHandle}
          image={comment.authorImage}
          name={comment.authorName}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <UserLink
              handle={comment.authorHandle}
              name={comment.authorName}
              className="font-medium"
            />
            <span className="text-xs text-muted-foreground">
              {timeAgo(comment._creationTime)}
            </span>
          </div>
          {isEditing ? (
            <div className="mt-1 flex w-full items-end gap-2">
              <MentionTextarea
                value={editContent}
                onChange={setEditContent}
                placeholder="Edit comment... (type @ to mention)"
                rows={2}
                className="min-w-0 flex-1 text-sm"
                autoFocus
              />
              <div className="flex flex-col gap-1 self-end">
                <Button
                  size="sm"
                  disabled={isSaving || !editContent.trim()}
                  onClick={handleEditSave}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditContent(comment.content);
                    setIsEditing(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm mt-0.5 whitespace-pre-wrap">
                {renderMentionContent(comment.content, comment.mentionedUsers)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => setShowReply(!showReply)}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <Reply className="h-3 w-3" />
                  Reply
                </button>
                {comment.isAuthor && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    <Edit className="h-3 w-3" />
                    Edit
                  </button>
                )}
                {(comment.isAuthor || isOwner) && (
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Delete
                  </button>
                )}
              </div>
            </>
          )}

          {showReply && (
            <form
              onSubmit={handleReply}
              className="mt-2 flex w-full items-end gap-2"
            >
              <MentionTextarea
                value={replyContent}
                onChange={setReplyContent}
                onSubmit={() =>
                  void handleReply(undefined as unknown as React.FormEvent)
                }
                placeholder="Write a reply... (type @ to mention)"
                rows={2}
                className="min-w-0 flex-1 text-sm"
                autoFocus
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !replyContent.trim()}
                className="shrink-0"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          )}

          {replies.length > 0 && (
            <div className="ml-2 mt-3 space-y-3 border-l-2 border-muted pl-3">
              {replies.map((reply) => (
                <ReplyItem key={reply._id} reply={reply} isOwner={isOwner} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
