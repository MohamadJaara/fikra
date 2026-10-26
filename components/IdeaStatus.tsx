import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  STATUS_COLORS,
  STATUS_DOT_COLORS,
  STATUS_LABELS,
  type Status,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

function isIdeaStatus(status: string): status is Status {
  return Object.hasOwn(STATUS_LABELS, status);
}

export function IdeaStatusLabel({ status }: { status: string }) {
  return isIdeaStatus(status) ? STATUS_LABELS[status] : status;
}

type IdeaStatusBadgeProps = Omit<BadgeProps, "children"> & {
  status: string;
  colored?: boolean;
};

export function IdeaStatusBadge({
  status,
  colored = true,
  variant = "secondary",
  className,
  ...props
}: IdeaStatusBadgeProps) {
  return (
    <Badge
      variant={variant}
      className={cn(
        colored &&
          (isIdeaStatus(status)
            ? STATUS_COLORS[status]
            : variant === "secondary" && "bg-muted"),
        className,
      )}
      {...props}
    >
      <IdeaStatusLabel status={status} />
    </Badge>
  );
}

export function IdeaStatusDot({
  status,
  className,
  decorative = false,
}: {
  status: string;
  className?: string;
  decorative?: boolean;
}) {
  const label = isIdeaStatus(status) ? STATUS_LABELS[status] : status;

  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        isIdeaStatus(status) ? STATUS_DOT_COLORS[status] : "bg-zinc-400",
        className,
      )}
    />
  );
}
