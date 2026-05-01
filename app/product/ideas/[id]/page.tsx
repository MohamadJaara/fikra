"use client";

import { api } from "@/convex/_generated/api";
import { useProductViewer } from "@/components/ProductLayoutClient";
import type { Id } from "@/convex/_generated/dataModel";
import {
  REACTION_EMOJI,
  REACTION_TYPES,
  STATUS_COLORS,
  STATUS_LABELS,
  ROOM_TYPE_LABELS,
  PARTICIPATION_MODE_LABELS,
  PARTICIPATION_MODE_COLORS,
  TEAM_SIZE_LABELS,
  type Status,
  type RoomType,
  type ParticipationMode,
} from "@/lib/constants";
import { useRolesMap } from "@/lib/hooks";
import type { IdeaDetail, CommentItem } from "@/lib/types";
import {
  use,
  useState,
  useMemo,
  useCallback,
  useEffect,
  Suspense,
} from "react";
import { useQuery, useMutation } from "convex/react";
import {
  MentionTextarea,
  renderMentionContent,
} from "@/components/MentionTextarea";
import { UserLink, UserAvatar } from "@/components/UserLink";
import { FeatureTip } from "@/components/FeatureTip";
import { OwnerWelcomeBanner } from "@/components/OwnerWelcomeBanner";
import { IdeaDetailSkeleton } from "@/components/Skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ArrowRightLeft,
  GitMerge,
  Link2,
  Search,
  AlertTriangle,
  DoorOpen,
  MapPin,
  Wifi,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast, Toaster } from "sonner";
import { useRouter } from "next/navigation";

export default function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          <IdeaDetailSkeleton />
        </div>
      }
    >
      <IdeaDetailContent params={params} />
    </Suspense>
  );
}

function IdeaDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ideaId = id as Id<"ideas">;
  const idea = useQuery(api.ideas.get, { ideaId });
  const comments = useQuery(api.comments.list, { ideaId });
  const searchParams = useSearchParams();
  const commentId = searchParams.get("comment");

  useEffect(() => {
    if (!commentId || !comments) return;
    const el = document.getElementById(`comment-${commentId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/30", "rounded-lg");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary/30", "rounded-lg");
      }, 3000);
    }
  }, [commentId, comments]);

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
        {idea.isOwner && <OwnerActions idea={idea} />}
      </div>

      <div className="space-y-6 animate-fade-in">
        <IdeaHeader idea={idea} />
        {idea.isOwner && <OwnerWelcomeBanner ideaId={idea._id} />}
        <OwnershipTransferRequestBanner idea={idea} />
        <IdeaContent idea={idea} />
        <RoomSection idea={idea} />
        <Separator />
        <div className="space-y-8">
          <section id="team" className="scroll-mt-24">
            <TeamSection idea={idea} ideaId={ideaId} />
          </section>

          <Separator />

          <section id="resources" className="scroll-mt-24">
            <ResourceSection idea={idea} />
          </section>

          <Separator />

          <section id="reactions" className="scroll-mt-24">
            <ReactionSection idea={idea} ideaId={ideaId} />
          </section>

          <Separator />

          <section id="interest" className="scroll-mt-24">
            <InterestSection idea={idea} ideaId={ideaId} />
          </section>

          <Separator />

          <section id="related" className="scroll-mt-24">
            <RelatedIdeasSection ideaId={ideaId} isOwner={idea.isOwner} />
          </section>

          <Separator />

          <section id="comments" className="scroll-mt-24">
            <CommentSection
              comments={comments}
              ideaId={ideaId}
              isOwner={idea.isOwner}
            />
          </section>
        </div>
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
        <div className="flex items-center gap-1.5 shrink-0">
          {idea.categoryName && (
            <Badge variant="outline">{idea.categoryName}</Badge>
          )}
          <Badge
            variant="secondary"
            className={STATUS_COLORS[idea.status as Status] || "bg-muted"}
          >
            {STATUS_LABELS[idea.status as Status] || idea.status}
          </Badge>
          {idea.onsiteOnly && (
            <Badge
              variant="outline"
              className="text-blue-700 border-blue-400 bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:bg-blue-950"
            >
              <MapPin className="h-3 w-3 mr-1" />
              On-site only
            </Badge>
          )}
        </div>
      </div>
      <p className="text-muted-foreground">{idea.pitch}</p>
      <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
        <UserAvatar
          handle={idea.ownerHandle}
          image={idea.ownerImage}
          name={idea.ownerName}
          size="md"
        />
        <UserLink handle={idea.ownerHandle} name={idea.ownerName} />
        <span>·</span>
        <span>{timeAgo(idea._creationTime)}</span>
      </div>
    </div>
  );
}

function OwnershipTransferRequestBanner({ idea }: { idea: IdeaDetail }) {
  const acceptMutation = useMutation(api.ideas.acceptOwnershipTransfer);
  const declineMutation = useMutation(api.ideas.declineOwnershipTransfer);
  const cancelMutation = useMutation(api.ideas.cancelOwnershipTransfer);
  const [action, setAction] = useState<"accept" | "decline" | "cancel" | null>(
    null,
  );
  const [ownerLeavesAfterAccept, setOwnerLeavesAfterAccept] = useState(false);
  const pending = idea.pendingOwnershipTransfer;

  if (!pending) return null;

  const handleAccept = async () => {
    setAction("accept");
    try {
      await acceptMutation({
        requestId: pending._id,
        leaveAfterTransfer: pending.isOwnerInitiated
          ? undefined
          : ownerLeavesAfterAccept,
      });
      toast.success(
        pending.isOwnerInitiated
          ? "Ownership accepted. This idea is yours now."
          : `${pending.requesterName} is now the owner.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to accept");
    } finally {
      setAction(null);
    }
  };

  const handleDecline = async () => {
    setAction("decline");
    try {
      await declineMutation({ requestId: pending._id });
      toast.success("Ownership transfer declined");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to decline");
    } finally {
      setAction(null);
    }
  };

  const handleCancel = async () => {
    setAction("cancel");
    try {
      await cancelMutation({ requestId: pending._id });
      toast.success("Ownership transfer request canceled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel");
    } finally {
      setAction(null);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/40 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Ownership transfer request</p>
          {pending.isOwnerInitiated && pending.isRecipient ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {pending.requesterName} asked you to take ownership of this idea.
              {pending.leaveAfterTransfer
                ? " They will leave the team if you accept."
                : " They will stay on the team if you accept."}
            </p>
          ) : pending.isOwnerInitiated ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Waiting for {pending.recipientName} to accept ownership.
              {pending.leaveAfterTransfer
                ? " You will leave the team after they accept."
                : " You will stay on the team after they accept."}
            </p>
          ) : pending.isRecipient ? (
            <div className="mt-1 space-y-2">
              <p className="text-sm text-muted-foreground">
                {pending.requesterName} asked to take ownership of this idea.
              </p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ownerLeavesAfterAccept}
                  onChange={(event) =>
                    setOwnerLeavesAfterAccept(event.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-muted-foreground">
                  Remove me from the team if I accept
                </span>
              </label>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Waiting for {pending.recipientName} to approve your ownership
              request.
            </p>
          )}
        </div>

        {pending.isRecipient ? (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              onClick={() => void handleAccept()}
              disabled={action !== null}
            >
              {action === "accept" ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Accept
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleDecline()}
              disabled={action !== null}
            >
              {action === "decline" ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-1" />
              )}
              Decline
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => void handleCancel()}
            disabled={action !== null}
          >
            {action === "cancel" ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <X className="h-4 w-4 mr-1" />
            )}
            Cancel request
          </Button>
        )}
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

function RoomSection({ idea }: { idea: IdeaDetail }) {
  if (!idea.room) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <DoorOpen className="h-5 w-5" />
        Room
      </h2>
      <div className="rounded-lg border px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{idea.room.roomName}</span>
          <Badge
            variant={idea.room.roomType === "shared" ? "default" : "secondary"}
            className="text-xs"
          >
            {ROOM_TYPE_LABELS[idea.room.roomType as RoomType] ||
              idea.room.roomType}
          </Badge>
        </div>
        {idea.room.roomType === "shared" &&
          idea.room.sharedWithIdeas.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Shared with:</p>
              <div className="flex flex-wrap gap-1.5">
                {idea.room.sharedWithIdeas.map((shared) => (
                  <Link
                    key={shared._id}
                    href={`/product/ideas/${shared._id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Link2 className="h-3 w-3" />
                    {shared.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
      </div>
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
  const requestOwnershipMutation = useMutation(api.ideas.requestOwnership);
  const roles = useQuery(api.roles.list);
  const viewer = useProductViewer();
  const roleLabels = useMemo(() => {
    if (!roles) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    for (const role of roles) {
      map[role.slug] = role.name;
    }
    return map;
  }, [roles]);
  const rolesList = useMemo(() => {
    if (!roles) return [] as { slug: string; name: string }[];
    return roles.map((role) => ({ slug: role.slug, name: role.name }));
  }, [roles]);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isRequestingOwnership, setIsRequestingOwnership] = useState(false);
  const areRolesLoading = roles === undefined;

  const requestedJoinRoles = useMemo(
    () =>
      idea.missingRoles.length > 0 ? idea.missingRoles : idea.lookingForRoles,
    [idea.missingRoles, idea.lookingForRoles],
  );

  const requestedJoinRoleSet = useMemo(
    () => new Set(requestedJoinRoles),
    [requestedJoinRoles],
  );

  const requestedRoleOptions = useMemo(
    () => rolesList.filter((role) => requestedJoinRoleSet.has(role.slug)),
    [rolesList, requestedJoinRoleSet],
  );

  const optionalRoleOptions = useMemo(
    () => rolesList.filter((role) => !requestedJoinRoleSet.has(role.slug)),
    [rolesList, requestedJoinRoleSet],
  );

  const selectedRoleNames = useMemo(
    () =>
      [...selectedRoles]
        .sort((a, b) => {
          const aRequested = requestedJoinRoleSet.has(a) ? 0 : 1;
          const bRequested = requestedJoinRoleSet.has(b) ? 0 : 1;
          if (aRequested !== bRequested) return aRequested - bRequested;
          return (roleLabels[a] || a).localeCompare(roleLabels[b] || b);
        })
        .map((slug) => roleLabels[slug] || slug),
    [selectedRoles, requestedJoinRoleSet, roleLabels],
  );
  const requiresRoleSelection = !areRolesLoading && rolesList.length > 0;

  const toggleRole = (slug: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleJoin = async () => {
    if (areRolesLoading) {
      toast.error("Roles are still loading. Please try again in a moment.");
      return;
    }

    setIsJoining(true);
    try {
      await joinMutation({
        ideaId,
        memberRoles: selectedRoles.size > 0 ? [...selectedRoles] : undefined,
      });
      setIsJoinDialogOpen(false);
      setSelectedRoles(new Set());
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

  const handleRequestOwnership = async () => {
    setIsRequestingOwnership(true);
    try {
      await requestOwnershipMutation({ ideaId });
      toast.success("Ownership request sent to the owner");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to request ownership",
      );
    } finally {
      setIsRequestingOwnership(false);
    }
  };

  const sortedMembers = useMemo(() => {
    const needed = new Set(idea.lookingForRoles);
    return [...idea.members].sort((a, b) => {
      if (a.userId === idea.ownerId) return -1;
      if (b.userId === idea.ownerId) return 1;
      const aHas = (a.memberRoles ?? []).some((r) => needed.has(r));
      const bHas = (b.memberRoles ?? []).some((r) => needed.has(r));
      if (aHas !== bHas) return aHas ? -1 : 1;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [idea.members, idea.ownerId, idea.lookingForRoles]);

  const neededRoles = useMemo(
    () => new Set(idea.lookingForRoles),
    [idea.lookingForRoles],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team
          </h2>
          <p className="text-sm text-muted-foreground">
            {idea.memberCount} {idea.memberCount === 1 ? "member" : "members"}{" "}
            · Team size: {TEAM_SIZE_LABELS[idea.teamSize]}
          </p>
        </div>
      </div>

      {sortedMembers.length > 0 && (
        <div className="space-y-2 mb-3">
          {sortedMembers.map((member) => (
            <div key={member._id} className="flex items-center gap-2 text-sm">
              <UserAvatar
                handle={member.handle}
                image={member.image}
                name={member.name}
                size="md"
              />
              <UserLink
                handle={member.handle}
                name={member.name}
                className="font-medium"
              />
              {(member.memberRoles ?? [])
                .sort((a, b) => {
                  const aM = neededRoles.has(a) ? 0 : 1;
                  const bM = neededRoles.has(b) ? 0 : 1;
                  if (aM !== bM) return aM - bM;
                  return (roleLabels[a] || a).localeCompare(roleLabels[b] || b);
                })
                .map((r) => {
                  const isMatch = neededRoles.has(r);
                  return (
                    <Badge
                      key={r}
                      variant="outline"
                      className={
                        isMatch
                          ? "text-[10px] px-1.5 py-0 text-emerald-700 border-emerald-400 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-950"
                          : "text-[11px]"
                      }
                    >
                      {roleLabels[r] || r}
                    </Badge>
                  );
                })}
              {(member.memberRoles?.length ?? 0) === 0 &&
                member.userId !== idea.ownerId && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 text-muted-foreground"
                  >
                    No team role set
                  </Badge>
                )}
              {member.userId === idea.ownerId && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Owner
                </Badge>
              )}
              {member.participationMode &&
              PARTICIPATION_MODE_LABELS[
                member.participationMode as ParticipationMode
              ] ? (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${PARTICIPATION_MODE_COLORS[member.participationMode as ParticipationMode]}`}
                >
                  {member.participationMode === "onsite" ? (
                    <MapPin className="h-2.5 w-2.5 mr-0.5" />
                  ) : (
                    <Wifi className="h-2.5 w-2.5 mr-0.5" />
                  )}
                  {
                    PARTICIPATION_MODE_LABELS[
                      member.participationMode as ParticipationMode
                    ]
                  }
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 text-muted-foreground"
                >
                  Mode not set
                </Badge>
              )}
              {idea.onsiteOnly &&
                member.participationMode !== "onsite" &&
                member.userId !== idea.ownerId && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                    This team requires on-site participation
                  </span>
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
                {roleLabels[role] || role}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {!idea.isOwner && (
        <>
          {idea.isMember && !idea.pendingOwnershipTransfer && (
            <FeatureTip tipKey="member-request-ownership">
              Want to lead this idea? You can <strong>request ownership</strong> — the current owner will be notified and can accept or decline.
            </FeatureTip>
          )}
          <div className="flex items-center gap-2 flex-wrap">
          {idea.isMember ? (
            <>
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestOwnership}
                disabled={
                  isRequestingOwnership ||
                  idea.pendingOwnershipTransfer !== null
                }
              >
                {isRequestingOwnership ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                )}
                {idea.pendingOwnershipTransfer
                  ? "Ownership pending"
                  : "Request ownership"}
              </Button>
            </>
          ) : (
            <>
              {idea.onsiteOnly && viewer?.participationMode !== "onsite" && (
                <div className="w-full rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-4 py-3">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    This team is limited to on-site participants only
                  </p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    {viewer?.participationMode === "remote"
                      ? 'Your participation mode is set to "Remote." Update it to "On-site" in Settings to join.'
                      : 'Set your participation mode to "On-site" in Settings to join this team.'}
                  </p>
                </div>
              )}
              {!(idea.onsiteOnly && viewer?.participationMode !== "onsite") ? (
                <>
                  <div className="flex-1 min-w-[260px] rounded-xl border bg-muted/20 px-4 py-3">
                    <p className="text-sm font-medium">
                      {requestedJoinRoles.length > 0
                        ? "The owner is actively looking for these roles"
                        : "Choose how you want to contribute"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {requestedJoinRoles.length > 0
                        ? "Open the join flow, pick one or more roles, then confirm your spot on the team."
                        : "Open the join flow to choose the role or skills you want to bring."}
                    </p>
                    {requestedRoleOptions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {requestedRoleOptions.map((role) => (
                          <Badge
                            key={role.slug}
                            variant="outline"
                            className="border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300"
                          >
                            {role.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Dialog
                    open={isJoinDialogOpen}
                    onOpenChange={(open) => {
                      setIsJoinDialogOpen(open);
                      if (!open && !isJoining) {
                        setSelectedRoles(new Set());
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm" disabled={areRolesLoading}>
                        {areRolesLoading ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4 mr-1" />
                        )}
                        {areRolesLoading ? "Loading roles..." : "Join Team"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Join {idea.title}</DialogTitle>
                        <DialogDescription>
                          This flow makes the choice explicit: first pick what
                          you will help with, then confirm your join request.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-5">
                        <div className="rounded-xl border bg-muted/20 p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              1
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium">Choose your role</p>
                              <p className="text-sm text-muted-foreground">
                                {areRolesLoading
                                  ? "We’re loading the available roles before you join."
                                  : requiresRoleSelection
                                    ? "Pick at least one role so the owner knows how you want to contribute."
                                    : "No roles have been configured yet, so you can join directly."}
                              </p>
                            </div>
                          </div>

                          {requestedRoleOptions.length > 0 && (
                            <div className="mt-4">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-foreground">
                                  Requested by owner
                                </p>
                                <span className="text-xs text-orange-700 dark:text-orange-300">
                                  Best place to start
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {requestedRoleOptions.map((role) => {
                                  const isSelected = selectedRoles.has(
                                    role.slug,
                                  );
                                  return (
                                    <button
                                      key={role.slug}
                                      type="button"
                                      onClick={() => toggleRole(role.slug)}
                                      className={cn(
                                        "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                                        isSelected
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                                          isSelected
                                            ? "border-primary-foreground/40"
                                            : "border-orange-400/70 text-orange-600 dark:border-orange-700 dark:text-orange-300",
                                        )}
                                      >
                                        {isSelected ? (
                                          <Check className="h-3 w-3" />
                                        ) : (
                                          "1"
                                        )}
                                      </span>
                                      {role.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {optionalRoleOptions.length > 0 && (
                            <div className="mt-4">
                              <p className="mb-2 text-sm font-medium text-muted-foreground">
                                Other roles you can bring
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {optionalRoleOptions.map((role) => {
                                  const isSelected = selectedRoles.has(
                                    role.slug,
                                  );
                                  return (
                                    <button
                                      key={role.slug}
                                      type="button"
                                      onClick={() => toggleRole(role.slug)}
                                      className={cn(
                                        "inline-flex min-h-10 items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                                        isSelected
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-border bg-muted/35 text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/60",
                                      )}
                                    >
                                      {role.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl border p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              2
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium">
                                Review before joining
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {selectedRoleNames.length > 0
                                  ? `You’re joining as ${selectedRoleNames.join(", ")}.`
                                  : requiresRoleSelection
                                    ? "No role selected yet. Choose at least one role to continue."
                                    : "You can confirm and join the team now."}
                              </p>
                            </div>
                          </div>

                          {selectedRoleNames.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {selectedRoleNames.map((role) => (
                                <Badge key={role} variant="secondary">
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setIsJoinDialogOpen(false)}
                          disabled={isJoining}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleJoin}
                          disabled={
                            isJoining ||
                            areRolesLoading ||
                            (requiresRoleSelection && selectedRoles.size === 0)
                          }
                        >
                          {isJoining ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <UserPlus className="h-4 w-4 mr-1" />
                          )}
                          {selectedRoles.size > 0
                            ? `Join with ${selectedRoles.size} role${selectedRoles.size === 1 ? "" : "s"}`
                            : areRolesLoading
                              ? "Loading roles..."
                              : requiresRoleSelection
                                ? "Select a role first"
                                : "Join team"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              ) : null}
            </>
          )}
        </div>
        </>
      )}
    </div>
  );
}

function ResourceSection({ idea }: { idea: IdeaDetail }) {
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

  return (
    <div>
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <Package className="h-5 w-5" />
        Resources ({
          idea.resourceRequests.filter((r) => !r.resolved).length
        }{" "}
        unresolved)
      </h2>
      {canManageResources && resources && resources.length > 0 && (
        <div className="mb-4 border rounded-lg p-3 space-y-3">
          <p className="text-sm font-medium">Add Resource Request</p>
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
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </div>
        </div>
      )}
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
                {req.resourceName}
              </span>
              {req.notes && (
                <span className="text-xs text-muted-foreground">
                  - {req.notes}
                </span>
              )}
            </div>
            {canManageResources && (
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
  const roleLabels = useRolesMap();
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
              <UserAvatar
                handle={user.handle}
                image={user.image}
                name={user.name}
              />
              <UserLink handle={user.handle} name={user.name} />
              {[...(user.roles ?? [])]
                .sort((a, b) => {
                  const aM = neededRoles.has(a) ? 0 : 1;
                  const bM = neededRoles.has(b) ? 0 : 1;
                  if (aM !== bM) return aM - bM;
                  return (roleLabels[a] || a).localeCompare(roleLabels[b] || b);
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
                      {roleLabels[r] || r}
                    </Badge>
                  );
                })}
              {user.participationMode &&
              PARTICIPATION_MODE_LABELS[
                user.participationMode as ParticipationMode
              ] ? (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${PARTICIPATION_MODE_COLORS[user.participationMode as ParticipationMode]}`}
                >
                  {user.participationMode === "onsite" ? (
                    <MapPin className="h-2.5 w-2.5 mr-0.5" />
                  ) : (
                    <Wifi className="h-2.5 w-2.5 mr-0.5" />
                  )}
                  {
                    PARTICIPATION_MODE_LABELS[
                      user.participationMode as ParticipationMode
                    ]
                  }
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 text-muted-foreground"
                >
                  Mode not set
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type RelatedIdea = {
  _id: string;
  _creationTime: number;
  relationType: string;
  mergeStatus: string | null;
  mergeRequestedById: string | null;
  mergeRequesterName: string | null;
  markedByName: string;
  otherIdeaId: Id<"ideas">;
  otherIdeaTitle: string;
  otherIdeaStatus: string | null;
  otherIdeaOwnerId: string | null;
  otherOwnerName: string;
  otherOwnerImage?: string;
  otherOwnerHandle?: string;
  otherMemberCount: number;
  sourceIdeaId: Id<"ideas"> | null;
};

type PotentialDuplicate = {
  _id: Id<"ideas">;
  title: string;
  pitch: string;
  status: string;
  ownerName: string;
  memberCount: number;
  score: number;
};

function RelatedIdeasSection({
  ideaId,
  isOwner,
}: {
  ideaId: Id<"ideas">;
  isOwner: boolean;
}) {
  const relations = useQuery(api.relatedIdeas.listForIdea, { ideaId });
  const duplicates = useQuery(
    api.relatedIdeas.searchPotentialDuplicates,
    isOwner ? { ideaId } : "skip",
  );
  const markRelatedMutation = useMutation(api.relatedIdeas.markRelated);
  const removeRelationMutation = useMutation(api.relatedIdeas.removeRelation);
  const requestMergeMutation = useMutation(api.relatedIdeas.requestMerge);
  const acceptMergeMutation = useMutation(api.relatedIdeas.acceptMerge);
  const declineMergeMutation = useMutation(api.relatedIdeas.declineMerge);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState<Id<"ideas"> | null>(
    null,
  );
  const [relationType, setRelationType] = useState<string>("related");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleMarkRelated = async () => {
    if (!selectedIdeaId) return;
    setActionLoading("mark");
    try {
      await markRelatedMutation({
        ideaIdA: ideaId,
        ideaIdB: selectedIdeaId,
        relationType,
      });
      toast.success(
        relationType === "duplicate"
          ? "Marked as duplicate"
          : "Marked as related",
      );
      setShowAddDialog(false);
      setSelectedIdeaId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (relationId: string) => {
    if (!confirm("Remove this relation?")) return;
    setActionLoading(relationId);
    try {
      await removeRelationMutation({
        relationId: relationId as Id<"relatedIdeas">,
      });
      toast.success("Relation removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestMerge = async (relationId: string) => {
    setActionLoading(`merge-${relationId}`);
    try {
      await requestMergeMutation({
        relationId: relationId as Id<"relatedIdeas">,
      });
      toast.success("Merge requested");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptMerge = async (relationId: string) => {
    if (
      !confirm(
        "Accept merge? The source idea will be deleted and its members will join your team.",
      )
    )
      return;
    setActionLoading(`accept-${relationId}`);
    try {
      await acceptMergeMutation({
        relationId: relationId as Id<"relatedIdeas">,
      });
      toast.success("Teams merged!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineMerge = async (relationId: string) => {
    setActionLoading(`decline-${relationId}`);
    try {
      await declineMergeMutation({
        relationId: relationId as Id<"relatedIdeas">,
      });
      toast.success("Merge declined");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const relatedItems = (relations || []) as RelatedIdea[];
  const potentialDuplicates = (duplicates || []) as PotentialDuplicate[];

  const related = relatedItems.filter((r) => r.relationType === "related");
  const duplicateRelations = relatedItems.filter(
    (r) => r.relationType === "duplicate",
  );

  const hasContent = relatedItems.length > 0 || isOwner;

  if (!hasContent) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Related Ideas
        </h2>
        {isOwner && (
          <div className="flex gap-2">
            <Dialog open={showDuplicates} onOpenChange={setShowDuplicates}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Search className="h-4 w-4 mr-1" />
                  Find Duplicates
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Potential Duplicates</DialogTitle>
                  <DialogDescription>
                    Ideas that might overlap with yours based on title and
                    description similarity.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 max-h-80 overflow-auto">
                  {duplicates === undefined ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : potentialDuplicates.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No potential duplicates found.
                    </p>
                  ) : (
                    potentialDuplicates.map((dup) => (
                      <div
                        key={dup._id}
                        className="rounded-lg border p-3 space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/product/ideas/${dup._id}`}
                              className="text-sm font-medium hover:underline"
                              target="_blank"
                            >
                              {dup.title}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              by {dup.ownerName} · {dup.memberCount} member
                              {dup.memberCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="text-xs shrink-0"
                          >
                            {Math.round(dup.score)}% match
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {dup.pitch}
                        </p>
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => {
                              setSelectedIdeaId(dup._id);
                              setRelationType("duplicate");
                              setShowDuplicates(false);
                              setShowAddDialog(true);
                            }}
                          >
                            Mark as Duplicate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => {
                              setSelectedIdeaId(dup._id);
                              setRelationType("related");
                              setShowDuplicates(false);
                              setShowAddDialog(true);
                            }}
                          >
                            Mark as Related
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Link2 className="h-4 w-4 mr-1" />
                  Link Idea
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Link a Related Idea</DialogTitle>
                  <DialogDescription>
                    Mark another idea as related or a duplicate of this one.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Idea ID</label>
                    <Input
                      placeholder="Paste the idea ID or URL"
                      value={selectedIdeaId || ""}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        const match = val.match(/([a-z0-9]{22,})/);
                        setSelectedIdeaId(
                          match ? (match[1] as Id<"ideas">) : null,
                        );
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Copy the idea URL or ID from the browse page.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Relation type</label>
                    <Select
                      value={relationType}
                      onValueChange={setRelationType}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="related">Related</SelectItem>
                        <SelectItem value="duplicate">Duplicate</SelectItem>
                      </SelectContent>
                    </Select>
                    {relationType === "duplicate" && (
                      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Marking as duplicate enables team merge requests.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void handleMarkRelated()}
                    disabled={!selectedIdeaId || actionLoading !== null}
                  >
                    {actionLoading === "mark" && (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    )}
                    Link
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {related.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs text-muted-foreground font-medium">Related</p>
          {related.map((rel) => (
            <RelatedIdeaCard
              key={rel._id}
              relation={rel}
              isOwner={isOwner}
              actionLoading={actionLoading}
              onRemove={handleRemove}
              onRequestMerge={handleRequestMerge}
              onAcceptMerge={handleAcceptMerge}
              onDeclineMerge={handleDeclineMerge}
            />
          ))}
        </div>
      )}

      {duplicateRelations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            Duplicates
          </p>
          {duplicateRelations.map((rel) => (
            <RelatedIdeaCard
              key={rel._id}
              relation={rel}
              isOwner={isOwner}
              actionLoading={actionLoading}
              onRemove={handleRemove}
              onRequestMerge={handleRequestMerge}
              onAcceptMerge={handleAcceptMerge}
              onDeclineMerge={handleDeclineMerge}
            />
          ))}
        </div>
      )}

      {relatedItems.length === 0 && isOwner && (
        <p className="text-sm text-muted-foreground">
          No linked ideas yet. Use &ldquo;Link Idea&rdquo; or &ldquo;Find
          Duplicates&rdquo; to get started.
        </p>
      )}
    </div>
  );
}

function RelatedIdeaCard({
  relation,
  isOwner,
  actionLoading,
  onRemove,
  onRequestMerge,
  onAcceptMerge,
  onDeclineMerge,
}: {
  relation: RelatedIdea;
  isOwner: boolean;
  actionLoading: string | null;
  onRemove: (id: string) => void;
  onRequestMerge: (id: string) => void;
  onAcceptMerge: (id: string) => void;
  onDeclineMerge: (id: string) => void;
}) {
  const isMergePending = relation.mergeStatus === "pending";
  const isMergeDeclined = relation.mergeStatus === "declined";
  const isSource =
    relation.sourceIdeaId !== null &&
    relation.otherIdeaId !== relation.sourceIdeaId;
  const isTarget =
    relation.sourceIdeaId !== null &&
    relation.otherIdeaId === relation.sourceIdeaId;

  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/product/ideas/${relation.otherIdeaId}`}
            className="font-medium hover:underline truncate"
          >
            {relation.otherIdeaTitle}
          </Link>
          {relation.relationType === "duplicate" && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 text-purple-600 border-purple-300 bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:bg-purple-950"
            >
              Duplicate
            </Badge>
          )}
          {relation.otherIdeaStatus && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {STATUS_LABELS[relation.otherIdeaStatus as Status] ||
                relation.otherIdeaStatus}
            </Badge>
          )}
          {isMergePending && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950"
            >
              Merge pending
            </Badge>
          )}
          {isMergeDeclined && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 text-red-600 border-red-300 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950"
            >
              Merge declined
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          by {relation.otherOwnerName} · {relation.otherMemberCount} member
          {relation.otherMemberCount !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isOwner &&
          relation.relationType === "duplicate" &&
          !relation.mergeStatus && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => onRequestMerge(relation._id)}
              disabled={actionLoading !== null}
            >
              <GitMerge className="h-3 w-3 mr-1" />
              Request Merge
            </Button>
          )}

        {isMergePending && isTarget && (
          <>
            <Button
              size="sm"
              className="text-xs h-7"
              onClick={() => onAcceptMerge(relation._id)}
              disabled={actionLoading !== null}
            >
              {actionLoading === `accept-${relation._id}` ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Accept Merge
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => onDeclineMerge(relation._id)}
              disabled={actionLoading !== null}
            >
              Decline
            </Button>
          </>
        )}

        {isMergePending && isSource && (
          <span className="text-xs text-muted-foreground">
            Waiting for response...
          </span>
        )}

        {isOwner && !isMergePending && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 text-destructive"
            onClick={() => onRemove(relation._id)}
            disabled={actionLoading === relation._id}
          >
            {actionLoading === relation._id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
            Remove
          </Button>
        )}
      </div>
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
        <FeatureTip tipKey="comment-mention">
          Type <strong>@</strong> in the comment box to mention a teammate — they'll get notified. Use the quick prompts above to kickstart the discussion.
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

type TransferCandidate = {
  _id: Id<"users">;
  name: string;
  image?: string;
  handle?: string;
};

function getUserDisplayName(user: {
  name?: string;
  firstName?: string;
  lastName?: string;
}) {
  return (
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    "Unnamed user"
  );
}

function memberToTransferCandidate(
  member: IdeaDetail["members"][number],
): TransferCandidate {
  return {
    _id: member.userId,
    name: member.name,
    image: member.image,
    handle: member.handle,
  };
}

function userToTransferCandidate(user: {
  _id: Id<"users">;
  name?: string;
  firstName?: string;
  lastName?: string;
  image?: string;
  handle?: string;
}): TransferCandidate {
  return {
    _id: user._id,
    name: getUserDisplayName(user),
    image: user.image,
    handle: user.handle,
  };
}

function CandidateAvatar({ candidate }: { candidate: TransferCandidate }) {
  return (
    <Avatar className="h-8 w-8">
      <AvatarImage src={candidate.image} />
      <AvatarFallback className="text-xs font-medium">
        {candidate.name.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function TransferCandidateButton({
  candidate,
  selected,
  onSelect,
}: {
  candidate: TransferCandidate;
  selected: boolean;
  onSelect: (candidate: TransferCandidate) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(candidate)}
      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/50"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <CandidateAvatar candidate={candidate} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{candidate.name}</p>
          {candidate.handle && (
            <p className="truncate text-xs text-muted-foreground">
              @{candidate.handle}
            </p>
          )}
        </div>
        {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
      </div>
    </button>
  );
}

function TransferOwnershipDialog({ idea, asDropdownItem }: { idea: IdeaDetail; asDropdownItem?: boolean }) {
  const requestMutation = useMutation(api.ideas.requestOwnershipTransfer);
  const cancelMutation = useMutation(api.ideas.cancelOwnershipTransfer);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TransferCandidate | null>(null);
  const [leaveAfterTransfer, setLeaveAfterTransfer] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const searchText = query.trim();
  const pending = idea.pendingOwnershipTransfer;

  const searchResults = useQuery(
    api.users.search,
    open && !pending && searchText.length > 0 ? { query: searchText } : "skip",
  );

  const memberCandidates = useMemo(
    () =>
      idea.members
        .filter((member) => member.userId !== idea.ownerId)
        .map(memberToTransferCandidate),
    [idea.members, idea.ownerId],
  );

  const searchCandidates = useMemo(() => {
    if (!searchResults) return [];

    const seen = new Set<Id<"users">>([
      idea.ownerId,
      ...memberCandidates.map((candidate) => candidate._id),
    ]);

    return searchResults
      .filter((user) => {
        if (seen.has(user._id)) return false;
        seen.add(user._id);
        return true;
      })
      .map(userToTransferCandidate);
  }, [idea.ownerId, memberCandidates, searchResults]);

  const reset = () => {
    setQuery("");
    setSelected(null);
    setLeaveAfterTransfer(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isRequesting || isCanceling) return;
    setOpen(nextOpen);
    if (!nextOpen) reset();
  };

  const handleRequest = async () => {
    if (!selected) return;
    setIsRequesting(true);
    try {
      await requestMutation({
        ideaId: idea._id,
        targetUserId: selected._id,
        leaveAfterTransfer,
      });
      toast.success(`Ownership request sent to ${selected.name}`);
      setOpen(false);
      reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to request transfer",
      );
    } finally {
      setIsRequesting(false);
    }
  };

  const handleCancel = async () => {
    if (!pending) return;
    setIsCanceling(true);
    try {
      await cancelMutation({ requestId: pending._id });
      toast.success("Ownership transfer request canceled");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel");
    } finally {
      setIsCanceling(false);
    }
  };

  const trigger = asDropdownItem ? (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        setOpen(true);
      }}
    >
      <ArrowRightLeft className="h-4 w-4 mr-2" />
      {pending ? "Transfer pending..." : "Transfer ownership"}
    </DropdownMenuItem>
  ) : (
    <DialogTrigger asChild>
      <Button variant="outline" size="sm">
        <ArrowRightLeft className="h-4 w-4 mr-1" />
        {pending ? "Transfer pending" : "Transfer"}
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {pending ? "Ownership transfer pending" : "Request transfer"}
          </DialogTitle>
          <DialogDescription>
            {pending
              ? `Waiting for ${pending.recipientName} to accept ownership of "${idea.title}".`
              : `Choose who should own "${idea.title}". They will need to accept before ownership changes.`}
          </DialogDescription>
        </DialogHeader>

        {pending ? (
          <>
            <div className="rounded-md border bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-3">
                <CandidateAvatar
                  candidate={{
                    _id: pending.recipientId,
                    name: pending.recipientName,
                    image: pending.recipientImage,
                    handle: pending.recipientHandle,
                  }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    Waiting on {pending.recipientName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pending.leaveAfterTransfer
                      ? "You will leave the team if they accept."
                      : "You will stay on the team if they accept."}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isCanceling}
              >
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleCancel()}
                disabled={isCanceling}
              >
                {isCanceling && (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                )}
                Cancel request
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4">
              {memberCandidates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Team members</p>
                  <div className="space-y-2">
                    {memberCandidates.map((candidate) => (
                      <TransferCandidateButton
                        key={candidate._id}
                        candidate={candidate}
                        selected={selected?._id === candidate._id}
                        onSelect={setSelected}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label
                  htmlFor="new-owner-search"
                  className="text-sm font-medium"
                >
                  Search people
                </label>
                <Input
                  id="new-owner-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name or handle"
                />
                {searchText.length > 0 && (
                  <div className="max-h-48 overflow-auto rounded-md border">
                    {searchResults === undefined ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching...
                      </div>
                    ) : searchCandidates.length > 0 ? (
                      <div className="space-y-1 p-1">
                        {searchCandidates.map((candidate) => (
                          <TransferCandidateButton
                            key={candidate._id}
                            candidate={candidate}
                            selected={selected?._id === candidate._id}
                            onSelect={setSelected}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        No matching people found.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {selected && (
                <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
                  <CandidateAvatar candidate={selected} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      Requested owner: {selected.name}
                    </p>
                    {selected.handle && (
                      <p className="truncate text-xs text-muted-foreground">
                        @{selected.handle}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <label className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={leaveAfterTransfer}
                  onChange={(event) =>
                    setLeaveAfterTransfer(event.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-border accent-primary"
                />
                <span>
                  <span className="font-medium">
                    Remove me from this team after transfer
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Use this when you are moving on to another idea.
                  </span>
                </span>
              </label>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isRequesting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleRequest()}
                disabled={!selected || isRequesting}
              >
                {isRequesting && (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                )}
                Send request
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OwnerActions({ idea }: { idea: IdeaDetail }) {
  const ideaId = idea._id;
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
    <div className="flex flex-wrap justify-end gap-2">
      <Link href={`/product/ideas/${ideaId}/edit`}>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4 mr-1" />
            More
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {(!idea.pendingOwnershipTransfer ||
            idea.pendingOwnershipTransfer.isOwnerInitiated) && (
            <TransferOwnershipDialog
              idea={idea}
              asDropdownItem
            />
          )}
          <DropdownMenuItem onClick={() => {
            document.getElementById("related")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}>
            <Link2 className="h-4 w-4 mr-2" />
            Find duplicates & link ideas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {
            document.getElementById("resources")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}>
            <Package className="h-4 w-4 mr-2" />
            Manage resources
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete idea
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
