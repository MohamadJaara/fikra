"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  REACTION_EMOJI,
  REACTION_TYPES,
  RESOURCE_TAG_LABELS,
  ROLE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  ROLES,
  type ResourceTag,
  type Role,
  type Status,
} from "@/lib/constants";
import type { IdeaDetail, CommentItem } from "@/lib/types";
import { use, useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  MentionTextarea,
  renderMentionContent,
} from "@/components/MentionTextarea";
import { IdeaDetailSkeleton } from "@/components/Skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Users,
  UserPlus,
  UserMinus,
  Heart,
  MessageSquare,
  Package,
  Check,
  X,
  Reply,
  Send,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast, Toaster } from "sonner";
import { useRouter } from "next/navigation";

export default function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const ideaId = id as Id<"ideas">;
  const idea = useQuery(api.ideas.get, { ideaId });
  const comments = useQuery(api.comments.list, { ideaId });

  if (idea === undefined || comments === undefined) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <IdeaDetailSkeleton />
      </div>
    );
  }

  if (idea === null) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-lg font-medium mb-2">Idea not found</p>
          <Link
            href="/product"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            Back to Browse
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/product"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Browse
        </Link>
        {idea.isOwner && <OwnerActions ideaId={ideaId} />}
      </div>

      <div className="space-y-6 animate-fade-in">
        <IdeaHeader idea={idea} />
        <IdeaContent idea={idea} />
        <Separator />
        <TeamSection idea={idea} ideaId={ideaId} />
        <Separator />
        <ResourceSection idea={idea} />
        <Separator />
        <ReactionSection idea={idea} ideaId={ideaId} />
        <Separator />
        <InterestSection idea={idea} ideaId={ideaId} />
        <Separator />
        <CommentSection
          comments={comments}
          ideaId={ideaId}
          isOwner={idea.isOwner}
        />
      </div>

      <Toaster />
    </div>
  );
}

function IdeaHeader({ idea }: { idea: IdeaDetail }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold">{idea.title}</h1>
        <Badge
          variant="secondary"
          className={STATUS_COLORS[idea.status as Status] || "bg-muted"}
        >
          {STATUS_LABELS[idea.status as Status] || idea.status}
        </Badge>
      </div>
      <p className="text-muted-foreground">{idea.pitch}</p>
      <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
          {idea.ownerImage ? (
            <img
              src={idea.ownerImage}
              alt=""
              className="h-6 w-6 rounded-full"
            />
          ) : (
            idea.ownerName?.charAt(0)?.toUpperCase() || "?"
          )}
        </div>
        <span>{idea.ownerName}</span>
        <span>·</span>
        <span>{timeAgo(idea._creationTime)}</span>
      </div>
    </div>
  );
}

function IdeaContent({ idea }: { idea: IdeaDetail }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-1">
          Problem
        </h3>
        <p className="text-sm whitespace-pre-wrap">{idea.problem}</p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-1">
          Target Audience
        </h3>
        <p className="text-sm whitespace-pre-wrap">{idea.targetAudience}</p>
      </div>
      {idea.skillsNeeded.length > 0 && (
        <div className="md:col-span-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Skills Needed
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {idea.skillsNeeded.map((skill, i) => (
              <Badge key={i} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamSection({
  idea,
  ideaId,
}: {
  idea: IdeaDetail;
  ideaId: Id<"ideas">;
}) {
  const joinMutation = useMutation(api.memberships.join);
  const leaveMutation = useMutation(api.memberships.leave);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const teamPercent =
    idea.teamSizeWanted > 0
      ? Math.min(100, (idea.memberCount / idea.teamSizeWanted) * 100)
      : 0;

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      await joinMutation({
        ideaId,
        role: selectedRole || undefined,
      });
      toast.success("Joined team!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join");
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    setIsLeaving(true);
    try {
      await leaveMutation({ ideaId });
      toast.success("Left team");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to leave");
    } finally {
      setIsLeaving(false);
    }
  };

  const sortedMembers = useMemo(() => {
    const needed = new Set(idea.lookingForRoles);
    return [...idea.members].sort((a, b) => {
      const aHas = [...(a.roles ?? []), a.role].some((r) => r && needed.has(r));
      const bHas = [...(b.roles ?? []), b.role].some((r) => r && needed.has(r));
      if (aHas !== bHas) return aHas ? -1 : 1;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [idea.members, idea.lookingForRoles]);

  const neededRoles = useMemo(
    () => new Set(idea.lookingForRoles),
    [idea.lookingForRoles],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team ({idea.memberCount}/{idea.teamSizeWanted})
        </h2>
      </div>

      <Progress value={teamPercent} className="h-2 mb-3" />

      {sortedMembers.length > 0 && (
        <div className="space-y-2 mb-3">
          {sortedMembers.map((member) => (
            <div key={member._id} className="flex items-center gap-2 text-sm">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                {member.image ? (
                  <img
                    src={member.image}
                    alt=""
                    className="h-7 w-7 rounded-full"
                  />
                ) : (
                  member.name?.charAt(0)?.toUpperCase() || "?"
                )}
              </div>
              <span className="font-medium">{member.name}</span>
              {[
                ...(member.role ? [member.role] : []),
                ...(member.roles?.filter((r) => r !== member.role) ?? []),
              ]
                .sort((a, b) => {
                  const aM = neededRoles.has(a) ? 0 : 1;
                  const bM = neededRoles.has(b) ? 0 : 1;
                  if (aM !== bM) return aM - bM;
                  return (ROLE_LABELS[a as Role] || a).localeCompare(
                    ROLE_LABELS[b as Role] || b,
                  );
                })
                .map((r) => {
                  const isMatch = neededRoles.has(r);
                  return (
                    <Badge
                      key={r}
                      variant={r === member.role ? "outline" : "secondary"}
                      className={
                        isMatch
                          ? "text-[10px] px-1.5 py-0 text-emerald-700 border-emerald-400 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-950"
                          : r === member.role
                            ? "text-[11px]"
                            : "text-[10px] px-1.5 py-0"
                      }
                    >
                      {ROLE_LABELS[r as Role] || r}
                    </Badge>
                  );
                })}
              {idea.isOwner && member._id === idea.members[0]?._id && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Owner
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {idea.missingRoles.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5">Missing roles:</p>
          <div className="flex flex-wrap gap-1.5">
            {idea.missingRoles.map((role) => (
              <Badge
                key={role}
                variant="outline"
                className="text-orange-600 border-orange-300 bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:bg-orange-950"
              >
                {ROLE_LABELS[role as Role] || role}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {!idea.isOwner && (
        <div className="flex items-center gap-2 flex-wrap">
          {idea.isMember ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLeave}
              disabled={isLeaving}
            >
              {isLeaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <UserMinus className="h-4 w-4 mr-1" />
              )}
              Leave Team
            </Button>
          ) : (
            <>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Pick a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific role</SelectItem>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleJoin} disabled={isJoining}>
                {isJoining ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-1" />
                )}
                Join Team
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResourceSection({ idea }: { idea: IdeaDetail }) {
  const resolveMutation = useMutation(api.resourceRequests.resolve);
  const unresolveMutation = useMutation(api.resourceRequests.unresolve);
  const removeMutation = useMutation(api.resourceRequests.remove);

  if (idea.resourceRequests.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <Package className="h-5 w-5" />
        Resources ({
          idea.resourceRequests.filter((r) => !r.resolved).length
        }{" "}
        unresolved)
      </h2>
      <div className="space-y-2">
        {idea.resourceRequests.map((req) => (
          <div
            key={req._id}
            className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2"
          >
            <div className="flex items-center gap-2">
              {req.resolved ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-red-500" />
              )}
              <span
                className={
                  req.resolved ? "line-through text-muted-foreground" : ""
                }
              >
                {RESOURCE_TAG_LABELS[req.tag as ResourceTag] || req.tag}
              </span>
              {req.notes && (
                <span className="text-xs text-muted-foreground">
                  — {req.notes}
                </span>
              )}
            </div>
            {idea.isOwner && (
              <div className="flex gap-1">
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

function ReactionSection({
  idea,
  ideaId,
}: {
  idea: IdeaDetail;
  ideaId: Id<"ideas">;
}) {
  const toggleMutation = useMutation(api.reactions.toggle);

  const handleToggle = async (type: string) => {
    try {
      await toggleMutation({ ideaId, type });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to react");
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <Heart className="h-5 w-5" />
        Reactions
      </h2>
      <div className="flex gap-2 flex-wrap">
        {REACTION_TYPES.map((type) => {
          const count = idea.reactionCounts[type] || 0;
          const isActive = idea.userReactions.includes(type);
          return (
            <Button
              key={type}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => void handleToggle(type)}
              className={`gap-1.5 transition-all active:scale-90 ${
                isActive ? "animate-bounce-in" : "hover:scale-105"
              }`}
            >
              <span>{REACTION_EMOJI[type]}</span>
              <span className="text-xs">{count}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function InterestSection({
  idea,
  ideaId,
}: {
  idea: IdeaDetail;
  ideaId: Id<"ideas">;
}) {
  const expressMutation = useMutation(api.interest.express);
  const removeMutation = useMutation(api.interest.remove);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      if (idea.isInterested) {
        await removeMutation({ ideaId });
        toast.success("Interest removed");
      } else {
        await expressMutation({ ideaId });
        toast.success("Interest expressed!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setIsToggling(false);
    }
  };

  const sortedUsers = useMemo(() => {
    const needed = new Set(idea.lookingForRoles);
    return [...idea.interestedUsers].sort((a, b) => {
      const aHas = (a.roles ?? []).some((r) => needed.has(r));
      const bHas = (b.roles ?? []).some((r) => needed.has(r));
      if (aHas !== bHas) return aHas ? -1 : 1;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [idea.interestedUsers, idea.lookingForRoles]);

  const neededRoles = useMemo(
    () => new Set(idea.lookingForRoles),
    [idea.lookingForRoles],
  );

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">
        Interested ({idea.interestCount})
      </h2>
      <div className="flex items-center gap-3 mb-3">
        <Button
          variant={idea.isInterested ? "default" : "outline"}
          size="sm"
          onClick={handleToggle}
          disabled={isToggling}
        >
          {isToggling ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : null}
          {idea.isInterested ? "Interested" : "I'm Interested"}
        </Button>
      </div>
      {sortedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sortedUsers.map((user) => (
            <div
              key={user._id}
              className="flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium">
                {user.image ? (
                  <img
                    src={user.image}
                    alt=""
                    className="h-5 w-5 rounded-full"
                  />
                ) : (
                  user.name?.charAt(0)?.toUpperCase() || "?"
                )}
              </div>
              <span>{user.name}</span>
              {[...(user.roles ?? [])]
                .sort((a, b) => {
                  const aM = neededRoles.has(a) ? 0 : 1;
                  const bM = neededRoles.has(b) ? 0 : 1;
                  if (aM !== bM) return aM - bM;
                  return (ROLE_LABELS[a as Role] || a).localeCompare(
                    ROLE_LABELS[b as Role] || b,
                  );
                })
                .map((r) => {
                  const isMatch = neededRoles.has(r);
                  return (
                    <Badge
                      key={r}
                      variant="secondary"
                      className={
                        isMatch
                          ? "text-[10px] px-1.5 py-0 text-emerald-700 border-emerald-400 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-950"
                          : "text-[10px] px-1.5 py-0"
                      }
                    >
                      {ROLE_LABELS[r as Role] || r}
                    </Badge>
                  );
                })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const QUICK_PROMPTS = [
  "What problem are you solving?",
  "What would an MVP look like?",
  "What help do you need?",
  "Any risks or blockers?",
];

function CommentSection({
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
        <div className="flex gap-2">
          <MentionTextarea
            value={content}
            onChange={setContent}
            onSubmit={() => void handleSubmit()}
            placeholder="Add a comment... (type @ to mention)"
            rows={2}
            className="flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !content.trim()}
            className="self-end"
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
          <CommentItem
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
    <div className="flex gap-2">
      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium shrink-0 mt-0.5">
        {reply.authorImage ? (
          <img
            src={reply.authorImage}
            alt=""
            className="h-6 w-6 rounded-full"
          />
        ) : (
          reply.authorName?.charAt(0)?.toUpperCase() || "?"
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-xs">{reply.authorName}</span>
          <span className="text-[11px] text-muted-foreground">
            {timeAgo(reply._creationTime)}
          </span>
        </div>
        {isEditing ? (
          <div className="flex gap-2 mt-1">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={2}
              className="flex-1 text-sm"
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

function CommentItem({
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
    <div>
      <div className="flex gap-2">
        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0 mt-0.5">
          {comment.authorImage ? (
            <img
              src={comment.authorImage}
              alt=""
              className="h-7 w-7 rounded-full"
            />
          ) : (
            comment.authorName?.charAt(0)?.toUpperCase() || "?"
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{comment.authorName}</span>
            <span className="text-xs text-muted-foreground">
              {timeAgo(comment._creationTime)}
            </span>
          </div>
          {isEditing ? (
            <div className="flex gap-2 mt-1">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={2}
                className="flex-1 text-sm"
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
            <form onSubmit={handleReply} className="flex gap-2 mt-2">
              <MentionTextarea
                value={replyContent}
                onChange={setReplyContent}
                onSubmit={() =>
                  void handleReply(undefined as unknown as React.FormEvent)
                }
                placeholder="Write a reply... (type @ to mention)"
                rows={2}
                className="flex-1 text-sm"
                autoFocus
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !replyContent.trim()}
                className="self-end"
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

function OwnerActions({ ideaId }: { ideaId: Id<"ideas"> }) {
  const deleteMutation = useMutation(api.ideas.remove);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this idea?")) return;
    try {
      await deleteMutation({ ideaId });
      toast.success("Idea deleted");
      router.push("/product");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  return (
    <div className="flex gap-2">
      <Link href={`/product/ideas/${ideaId}/edit`}>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </Link>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive"
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4 mr-1" />
        Delete
      </Button>
    </div>
  );
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
