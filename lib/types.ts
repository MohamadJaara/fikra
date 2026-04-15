import type { Id } from "../convex/_generated/dataModel";

export type IdeaListItem = {
  _id: Id<"ideas">;
  _creationTime: number;
  title: string;
  pitch: string;
  problem: string;
  targetAudience: string;
  skillsNeeded: string[];
  teamSizeWanted: number;
  status: string;
  lookingForRoles: string[];
  ownerId: Id<"users">;
  ownerName: string;
  ownerImage?: string;
  ownerHandle?: string;
  memberCount: number;
  interestCount: number;
  reactionCounts: Record<string, number>;
  userReactions: string[];
  missingRoles: string[];
  hasUnresolvedResources: boolean;
  resourceRequestCount: number;
  resourceRequests: ResourceRequestItem[];
  isMember: boolean;
  isInterested: boolean;
  isOwner: boolean;
};

export type ResourceRequestItem = {
  _id: Id<"resourceRequests">;
  _creationTime: number;
  ideaId: Id<"ideas">;
  tag: string;
  notes?: string;
  resolved: boolean;
};

export type IdeaMember = {
  _id: Id<"ideaMembers">;
  _creationTime: number;
  ideaId: Id<"ideas">;
  userId: Id<"users">;
  role?: string;
  name: string;
  image?: string;
  email?: string;
  roles?: string[];
  handle?: string;
};

export type InterestedUser = {
  _id: Id<"ideaInterest">;
  _creationTime: number;
  ideaId: Id<"ideas">;
  userId: Id<"users">;
  name: string;
  image?: string;
  roles?: string[];
  handle?: string;
};

export type IdeaDetail = {
  _id: Id<"ideas">;
  _creationTime: number;
  title: string;
  pitch: string;
  problem: string;
  targetAudience: string;
  skillsNeeded: string[];
  teamSizeWanted: number;
  status: string;
  lookingForRoles: string[];
  ownerId: Id<"users">;
  ownerName: string;
  ownerImage?: string;
  ownerHandle?: string;
  ownerEmail?: string;
  members: IdeaMember[];
  memberCount: number;
  interestedUsers: InterestedUser[];
  interestCount: number;
  reactionCounts: Record<string, number>;
  userReactions: string[];
  resourceRequests: ResourceRequestItem[];
  hasUnresolvedResources: boolean;
  missingRoles: string[];
  isMember: boolean;
  isInterested: boolean;
  isOwner: boolean;
};

export type MentionedUser = {
  _id: Id<"users">;
  name: string;
  handle?: string;
};

export type CommentItem = {
  _id: Id<"comments">;
  _creationTime: number;
  ideaId: Id<"ideas">;
  userId: Id<"users">;
  content: string;
  parentId?: Id<"comments">;
  authorName: string;
  authorImage?: string;
  authorHandle?: string;
  isAuthor: boolean;
  mentionedUsers?: MentionedUser[];
};

export type ProfileIdea = {
  _id: Id<"ideas">;
  _creationTime: number;
  title: string;
  pitch: string;
  status: string;
  lookingForRoles: string[];
};

export type JoinedIdea = ProfileIdea & {
  memberRole?: string;
};

export type PublicUser = {
  _id: Id<"users">;
  _creationTime: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  image?: string;
  roles?: string[];
  handle?: string;
};

export type UserProfile = {
  _id: Id<"users">;
  _creationTime: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  image?: string;
  roles?: string[];
  handle?: string;
  ownedIdeas: ProfileIdea[];
  joinedIdeas: JoinedIdea[];
};

export type UnresolvedResource = {
  _id: Id<"resourceRequests">;
  _creationTime: number;
  ideaId: Id<"ideas">;
  tag: string;
  notes?: string;
  resolved: boolean;
  ideaTitle: string;
  ownerName: string;
};
