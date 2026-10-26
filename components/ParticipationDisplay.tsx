import { MapPin, Wifi } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  PARTICIPATION_MODE_COLORS,
  PARTICIPATION_MODE_LABELS,
  type ParticipationMode,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const PARTICIPATION_ICONS = { onsite: MapPin, remote: Wifi };
const PARTICIPATION_INDICATOR_COLORS = {
  onsite: "text-blue-500",
  remote: "text-purple-500",
};

function isParticipationMode(
  mode: string | undefined,
): mode is ParticipationMode {
  return mode !== undefined && Object.hasOwn(PARTICIPATION_MODE_LABELS, mode);
}

type ParticipationBadgeProps = Omit<BadgeProps, "children"> & {
  mode: string | undefined;
  iconClassName?: string;
};

// Missing or unrecognized modes stay hidden rather than implying a preference.
export function ParticipationBadge({
  mode,
  className,
  iconClassName,
  variant = "outline",
  ...props
}: ParticipationBadgeProps) {
  if (!isParticipationMode(mode)) return null;
  const Icon = PARTICIPATION_ICONS[mode];

  return (
    <Badge
      variant={variant}
      className={cn(PARTICIPATION_MODE_COLORS[mode], className)}
      {...props}
    >
      <Icon aria-hidden="true" className={cn("mr-1 h-3 w-3", iconClassName)} />
      {PARTICIPATION_MODE_LABELS[mode]}
    </Badge>
  );
}

export function ParticipationIndicator({
  mode,
  showLabel = false,
  className,
  iconClassName,
}: {
  mode: string | undefined;
  showLabel?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  if (!isParticipationMode(mode)) return null;
  const Icon = PARTICIPATION_ICONS[mode];
  const label = PARTICIPATION_MODE_LABELS[mode];

  return (
    <span
      role={showLabel ? undefined : "img"}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
      className={cn(
        "inline-flex items-center gap-0.5",
        !showLabel && "shrink-0",
        !showLabel && PARTICIPATION_INDICATOR_COLORS[mode],
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn("h-3 w-3", iconClassName)} />
      {showLabel && label}
    </span>
  );
}
