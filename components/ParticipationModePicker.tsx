"use client";

import { MapPin, Wifi } from "lucide-react";
import {
  PARTICIPATION_MODES,
  PARTICIPATION_MODE_COLORS,
  PARTICIPATION_MODE_LABELS,
  type ParticipationMode,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

type ParticipationModePickerProps = {
  value: ParticipationMode | undefined;
  onChange: (value: ParticipationMode | undefined) => void;
  compact?: boolean;
  showUndecided?: boolean;
  ariaLabel?: string;
};

export function ParticipationModePicker({
  value,
  onChange,
  compact = false,
  showUndecided = false,
  ariaLabel = "Participation mode",
}: ParticipationModePickerProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {PARTICIPATION_MODES.map((mode) => {
        const active = value === mode;
        const Icon = mode === "onsite" ? MapPin : Wifi;

        return (
          <button
            type="button"
            key={mode}
            aria-pressed={active}
            onClick={() => onChange(active ? undefined : mode)}
            className={cn(
              "inline-flex items-center border text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              compact
                ? "rounded-md px-3 py-1.5 font-semibold"
                : "rounded-full px-3.5 py-1.5 font-medium transition-all duration-200",
              active
                ? cn(
                    PARTICIPATION_MODE_COLORS[mode],
                    compact && "shadow hover:bg-primary/80",
                  )
                : "border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-muted/50",
            )}
          >
            <Icon
              aria-hidden="true"
              className={compact ? "mr-1.5 h-3 w-3" : "mr-1.5 h-3.5 w-3.5"}
            />
            {PARTICIPATION_MODE_LABELS[mode]}
          </button>
        );
      })}
      {showUndecided && value === undefined && (
        <span className="inline-flex items-center rounded-full border border-dashed border-border px-3.5 py-1.5 text-sm text-muted-foreground">
          Not decided yet
        </span>
      )}
    </div>
  );
}
