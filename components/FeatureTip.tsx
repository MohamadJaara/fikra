"use client";

import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type FeatureTipProps = {
  tipKey: string;
  children: React.ReactNode;
  className?: string;
};

const SEEN_KEY = "fikra_seen_tips";

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSeenTips(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markTipSeen(key: string) {
  const seen = getSeenTips();
  seen.add(key);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {}
  emitChange();
}

export function FeatureTip({ tipKey, children, className }: FeatureTipProps) {
  const [isSeen, setIsSeen] = useState(true); // Default to hidden to avoid flash

  useEffect(() => {
    const check = () => setIsSeen(getSeenTips().has(tipKey));
    check();
    return subscribe(check);
  }, [tipKey]);

  if (isSeen) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-blue-200/80 bg-blue-50/80 px-3 py-2.5 text-blue-950 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100 animate-fade-in",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
        <div className="flex-1 min-w-0 text-sm leading-relaxed">{children}</div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-blue-600/60 hover:text-blue-600 dark:text-blue-300/60 dark:hover:text-blue-300"
          onClick={() => {
            markTipSeen(tipKey);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
