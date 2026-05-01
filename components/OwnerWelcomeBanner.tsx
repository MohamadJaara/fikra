"use client";

import { useState, useEffect } from "react";
import { Crown, ArrowRightLeft, Link2, Search, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SEEN_KEY = "fikra_seen_owner_welcome";

function hasSeenOwnerWelcome(ideaId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    return seen.includes(ideaId);
  } catch {
    return true;
  }
}

function markOwnerWelcomeSeen(ideaId: string) {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    seen.push(ideaId);
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {}
}

type OwnerWelcomeBannerProps = {
  ideaId: string;
  className?: string;
};

const OWNER_POWERS = [
  {
    icon: <ArrowRightLeft className="h-4 w-4" />,
    label: "Transfer ownership",
    description: "Hand off this idea to another team member",
  },
  {
    icon: <Search className="h-4 w-4" />,
    label: "Find duplicates",
    description: "Discover similar ideas and propose merges",
  },
  {
    icon: <Link2 className="h-4 w-4" />,
    label: "Link related ideas",
    description: "Connect ideas that overlap or complement yours",
  },
  {
    icon: <Package className="h-4 w-4" />,
    label: "Request resources",
    description: "Add resource needs for your team",
  },
];

export function OwnerWelcomeBanner({
  ideaId,
  className,
}: OwnerWelcomeBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!hasSeenOwnerWelcome(ideaId));
  }, [ideaId]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-purple-200/80 bg-gradient-to-br from-purple-50 to-blue-50 px-4 py-4 text-purple-950 shadow-sm dark:from-purple-950/40 dark:to-blue-950/40 dark:border-purple-900/60 dark:text-purple-100 animate-fade-in",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Crown className="mt-0.5 h-5 w-5 shrink-0 text-purple-600 dark:text-purple-300" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              You own this idea! Here's what you can do:
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-purple-600/60 hover:text-purple-600 dark:text-purple-300/60 dark:hover:text-purple-300"
              onClick={() => {
                markOwnerWelcomeSeen(ideaId);
                setVisible(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OWNER_POWERS.map((power) => (
              <div
                key={power.label}
                className="flex items-start gap-2 rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2"
              >
                <span className="shrink-0 text-purple-600 dark:text-purple-300">
                  {power.icon}
                </span>
                <div>
                  <p className="text-xs font-medium">{power.label}</p>
                  <p className="text-xs text-purple-800/70 dark:text-purple-200/70">
                    {power.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-purple-700/70 dark:text-purple-200/60">
            Use the <strong>Edit</strong> and <strong>More</strong> buttons above to access these features.
          </p>
        </div>
      </div>
    </div>
  );
}
