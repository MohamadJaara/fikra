"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit,
  Trash2,
  ArrowRightLeft,
  Link2,
  Package,
  MoreHorizontal,
  Check,
  Loader2,
  CheckCircle2,
  MapPin,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { IdeaDetail } from "@/lib/types";
import {
  type TransferCandidate,
  memberToTransferCandidate,
  userToTransferCandidate,
} from "./shared";

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

function TransferOwnershipDialog({
  idea,
  asDropdownItem,
}: {
  idea: IdeaDetail;
  asDropdownItem?: boolean;
}) {
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

export function OwnerActions({ idea }: { idea: IdeaDetail }) {
  const ideaId = idea._id;
  const deleteMutation = useMutation(api.ideas.remove);
  const shelveMutation = useMutation(api.ideas.shelve);
  const unshelveMutation = useMutation(api.ideas.unshelve);
  const markTeamFormedMutation = useMutation(api.ideas.markTeamFormed);
  const markTeamFormingMutation = useMutation(api.ideas.markTeamForming);
  const router = useRouter();
  const [isUpdatingFormation, setIsUpdatingFormation] = useState(false);
  const [isUpdatingShelf, setIsUpdatingShelf] = useState(false);
  const isShelved = idea.status === "shelved";

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

  const handleMarkFormed = async () => {
    setIsUpdatingFormation(true);
    try {
      await markTeamFormedMutation({ ideaId });
      toast.success("Team marked formed. Room request queued.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update team",
      );
    } finally {
      setIsUpdatingFormation(false);
    }
  };

  const handleMarkForming = async () => {
    setIsUpdatingFormation(true);
    try {
      await markTeamFormingMutation({ ideaId });
      toast.success("Team moved back to forming");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update team",
      );
    } finally {
      setIsUpdatingFormation(false);
    }
  };

  const handleShelfToggle = async () => {
    if (isShelved) {
      setIsUpdatingShelf(true);
      try {
        await unshelveMutation({ ideaId });
        toast.success("Idea reopened");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to reopen idea",
        );
      } finally {
        setIsUpdatingShelf(false);
      }
      return;
    }

    if (
      !confirm(
        "Shelve this idea? It will stay visible and others can request ownership.",
      )
    ) {
      return;
    }

    setIsUpdatingShelf(true);
    try {
      await shelveMutation({ ideaId });
      toast.success("Idea shelved. Others can request ownership.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to shelve idea",
      );
    } finally {
      setIsUpdatingShelf(false);
    }
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {isShelved ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleShelfToggle()}
          disabled={isUpdatingShelf}
        >
          {isUpdatingShelf ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <ArchiveRestore className="h-4 w-4 mr-1" />
          )}
          Reopen
        </Button>
      ) : idea.teamFormationStatus === "formed" ? (
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          disabled
        >
          <MapPin className="h-4 w-4 mr-1" />
          {idea.roomRequestStatus === "assigned"
            ? "Room assigned"
            : "Room requested"}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleMarkFormed()}
          disabled={isUpdatingFormation}
        >
          {isUpdatingFormation ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-1" />
          )}
          Mark formed
        </Button>
      )}
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
            <TransferOwnershipDialog idea={idea} asDropdownItem />
          )}
          <DropdownMenuItem
            onClick={() => void handleShelfToggle()}
            disabled={isUpdatingShelf}
          >
            {isUpdatingShelf ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isShelved ? (
              <ArchiveRestore className="h-4 w-4 mr-2" />
            ) : (
              <Archive className="h-4 w-4 mr-2" />
            )}
            {isShelved ? "Reopen idea" : "Shelve idea"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              document
                .getElementById("related")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <Link2 className="h-4 w-4 mr-2" />
            Find duplicates & link ideas
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              document
                .getElementById("resources")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <Package className="h-4 w-4 mr-2" />
            Manage resources
          </DropdownMenuItem>
          {idea.teamFormationStatus === "formed" && !idea.room && (
            <DropdownMenuItem
              onClick={() => void handleMarkForming()}
              disabled={isUpdatingFormation}
            >
              {isUpdatingFormation ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Mark team still forming
            </DropdownMenuItem>
          )}
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
