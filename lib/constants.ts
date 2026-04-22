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

export const STATUS_BORDER_COLORS: Record<Status, string> = {
  exploring: "border-l-blue-400 dark:border-l-blue-500",
  forming_team: "border-l-amber-400 dark:border-l-amber-500",
  full: "border-l-gray-300 dark:border-l-gray-600",
  building: "border-l-emerald-400 dark:border-l-emerald-500",
};

export const PARTICIPATION_MODES = ["onsite", "remote"] as const;
export type ParticipationMode = (typeof PARTICIPATION_MODES)[number];

export const PARTICIPATION_MODE_LABELS: Record<ParticipationMode, string> = {
  onsite: "On-site",
  remote: "Remote",
};

export const PARTICIPATION_MODE_COLORS: Record<ParticipationMode, string> = {
  onsite:
    "text-blue-700 border-blue-400 bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:bg-blue-950",
  remote:
    "text-purple-700 border-purple-400 bg-purple-50 dark:text-purple-300 dark:border-purple-700 dark:bg-purple-950",
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

export const TEAM_SIZES = ["solo", "small", "medium", "large"] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

export const TEAM_SIZE_LABELS: Record<TeamSize, string> = {
  solo: "Solo",
  small: "2–3",
  medium: "4–6",
  large: "7+",
};

const TEAM_SIZE_ORDER: Record<TeamSize, number> = {
  solo: 0,
  small: 1,
  medium: 2,
  large: 3,
};

export function teamSizeFromLegacyNumber(value: number): TeamSize {
  if (value <= 1) return "solo";
  if (value <= 3) return "small";
  if (value <= 6) return "medium";
  return "large";
}

export function maxTeamSize(a: TeamSize, b: TeamSize): TeamSize {
  return TEAM_SIZE_ORDER[a] >= TEAM_SIZE_ORDER[b] ? a : b;
}

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
