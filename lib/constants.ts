export const STATUSES = [
  "exploring",
  "forming_team",
  "full",
  "building",
] as const;
export type Status = (typeof STATUSES)[number];

export const REACTION_TYPES = [
  "interested",
  "exciting",
  "clever",
  "might_join",
] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const REACTION_EMOJI: Record<ReactionType, string> = {
  interested: "👍",
  exciting: "🚀",
  clever: "🧠",
  might_join: "🙋",
};

export const STATUS_LABELS: Record<Status, string> = {
  exploring: "Exploring",
  forming_team: "Forming Team",
  full: "Full",
  building: "Building",
};

export const STATUS_COLORS: Record<Status, string> = {
  exploring: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  forming_team:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  full: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  building: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export const ROOM_TYPES = ["team", "shared"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  team: "Team",
  shared: "Shared",
};

export const SORT_OPTIONS = [
  "newest",
  "oldest",
  "most_reactions",
  "most_interest",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest First",
  oldest: "Oldest First",
  most_reactions: "Most Reactions",
  most_interest: "Most Interest",
};

export const LEGACY_RESOURCE_LABELS: Record<string, string> = {
  linux_vps: "Linux VPS",
  mac_mini: "Mac Mini",
  llm_api_key: "LLM API Key",
  design_help: "Design Help",
  security_review: "Security Review",
  legal_compliance: "Legal/Compliance",
  hardware: "Hardware/Device",
  mentoring: "Mentoring",
};
