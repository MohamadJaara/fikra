"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import {
  Link2,
  Search,
  AlertTriangle,
  GitMerge,
  Check,
  X,
  Loader2,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABELS, type Status } from "@/lib/constants";
import { toast } from "sonner";

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

export function RelatedIdeasSection({
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
