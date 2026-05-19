import type { Id } from "@/convex/_generated/dataModel";
import type { IdeaDetail } from "@/lib/types";

export function timeAgo(timestamp: number): string {
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

export type TransferCandidate = {
  _id: Id<"users">;
  name: string;
  image?: string;
  handle?: string;
};

export function getUserDisplayName(user: {
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

export function memberToTransferCandidate(
  member: IdeaDetail["members"][number],
): TransferCandidate {
  return {
    _id: member.userId,
    name: member.name,
    image: member.image,
    handle: member.handle,
  };
}

export function userToTransferCandidate(user: {
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
