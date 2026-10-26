"use client";

import { Check, Circle } from "lucide-react";
import { badgeVariants } from "@/components/ui/badge";
import type { RoleOption } from "@/lib/hooks";
import { cn } from "@/lib/utils";

type RolePickerProps = {
  roles: readonly RoleOption[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  ariaLabel: string;
  isLoading: boolean;
  disabled?: boolean;
  variant?: "badge" | "pill" | "requested" | "optional";
  className?: string;
  itemClassName?: string;
};

export function RolePicker({
  roles,
  value,
  onChange,
  ariaLabel,
  isLoading,
  disabled = false,
  variant = "badge",
  className,
  itemClassName,
}: RolePickerProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-busy={isLoading}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading roles...
        </p>
      ) : roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No roles configured yet.
        </p>
      ) : (
        roles.map((role) => {
          const selected = value.includes(role.slug);
          return (
            <button
              key={role.slug}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() =>
                onChange(
                  selected
                    ? value.filter((slug) => slug !== role.slug)
                    : [...value, role.slug],
                )
              }
              className={cn(
                "cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                variant === "badge" &&
                  badgeVariants({ variant: selected ? "default" : "outline" }),
                variant === "pill" && [
                  "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-muted/50",
                ],
                variant === "requested" && [
                  "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-dashed border-orange-300/80 bg-transparent text-orange-700 hover:border-orange-400 hover:bg-orange-50/50 dark:border-orange-700/50 dark:text-orange-300 dark:hover:border-orange-600 dark:hover:bg-orange-950/40",
                ],
                variant === "optional" && [
                  "inline-flex min-h-10 items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/35 text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/60",
                ],
                itemClassName,
              )}
            >
              {variant === "requested" && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition-colors",
                    selected
                      ? "border-primary-foreground/40"
                      : "border-orange-300/60 text-orange-500 dark:border-orange-700/40 dark:text-orange-500",
                  )}
                >
                  {selected ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Circle className="h-2.5 w-2.5" />
                  )}
                </span>
              )}
              {role.name}
            </button>
          );
        })
      )}
    </div>
  );
}
