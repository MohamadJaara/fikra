"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  UserPlus,
  UserMinus,
  Loader2,
  ArrowRightLeft,
  Check,
  MapPin,
  Wifi,
} from "lucide-react";
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
import { UserAvatar, UserLink } from "@/components/UserLink";
import { FeatureTip } from "@/components/FeatureTip";
import { useProductViewer } from "@/components/ProductLayoutClient";
import { cn } from "@/lib/utils";
import {
  PARTICIPATION_MODE_LABELS,
  PARTICIPATION_MODE_COLORS,
  TEAM_SIZE_LABELS,
  type ParticipationMode,
} from "@/lib/constants";
import { toast } from "sonner";
import type { IdeaDetail } from "@/lib/types";

export function TeamSection({
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
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(() => new Set());
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
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground">
          Team ({idea.memberCount}/{TEAM_SIZE_LABELS[idea.teamSize]})
        </p>
      </div>

      {sortedMembers.length > 0 && (
        <div className="space-y-0 mb-4">
          {sortedMembers.map((member) => (
            <div
              key={member._id}
              className="flex items-center gap-2.5 text-sm py-1.5 border-b border-border/50 last:border-0"
            >
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
                    No role set
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
                    Requires on-site
                  </span>
                )}
            </div>
          ))}
        </div>
      )}

      {idea.missingRoles.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] text-muted-foreground mb-1.5">
            Still looking for
          </p>
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

      {!idea.isOwner && idea.isMember && !idea.pendingOwnershipTransfer && (
        <FeatureTip tipKey="member-request-ownership">
          Want to lead this idea? You can <strong>request ownership</strong> —
          the current owner will be notified and can accept or decline.
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
            {!idea.isOwner && (
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
            )}
          </>
        ) : (
          <>
            {idea.onsiteOnly && viewer?.participationMode !== "onsite" && (
              <div className="w-full rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  This team is limited to on-site participants only
                </p>
                <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-300/80">
                  {viewer?.participationMode === "remote"
                    ? 'Your participation mode is set to "Remote." Update it to "On-site" in Settings to join.'
                    : 'Set your participation mode to "On-site" in Settings to join this team.'}
                </p>
              </div>
            )}
            {!(idea.onsiteOnly && viewer?.participationMode !== "onsite") ? (
              <>
                <div className="flex-1 min-w-[260px] py-2">
                  <p className="text-sm font-medium">
                    {requestedJoinRoles.length > 0
                      ? "Looking for these roles"
                      : "Choose how you want to contribute"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {requestedJoinRoles.length > 0
                      ? "Open the join flow, pick one or more roles, then confirm."
                      : "Open the join flow to choose the role or skills you bring."}
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
                        Pick what you will help with, then confirm your spot on
                        the team.
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
                                ? "Loading available roles..."
                                : requiresRoleSelection
                                  ? "Pick at least one role so the owner knows how you want to contribute."
                                  : "No roles configured yet, you can join directly."}
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
                                const isSelected = selectedRoles.has(role.slug);
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
                                const isSelected = selectedRoles.has(role.slug);
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
                            <p className="font-medium">Review before joining</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedRoleNames.length > 0
                                ? `You're joining as ${selectedRoleNames.join(", ")}.`
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
    </div>
  );
}
