"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { IdeaDetail } from "@/lib/types";

export function OwnershipTransferRequestBanner({
  idea,
}: {
  idea: IdeaDetail;
}) {
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
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/30 px-4 py-3 mb-6">
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
