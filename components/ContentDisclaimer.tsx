"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const DISCLAIMER_STORAGE_KEY = "fikra_content_disclaimer_dismissed";

type ContentDisclaimerProps = {
  className?: string;
};

export function ContentDisclaimer({ className }: ContentDisclaimerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      /* eslint-disable react-hooks/set-state-in-effect, @eslint-react/set-state-in-effect */
      setVisible(localStorage.getItem(DISCLAIMER_STORAGE_KEY) !== "true");
    } catch {
      setVisible(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect, @eslint-react/set-state-in-effect */
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISCLAIMER_STORAGE_KEY, "true");
    } catch {}
  };

  return (
    <div
      role="note"
      className={cn(
        "flex h-auto w-full items-center gap-2 border-b border-amber-200/70 bg-amber-50 py-1.5 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
        className,
      )}
    >
      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
      <p className="min-w-0 flex-1 truncate text-xs font-medium">
        Hackathon ideas only — no company secrets, internal info, or customer
        data.
      </p>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded px-1 py-0.5 text-[11px] font-medium text-amber-800 underline underline-offset-2 transition-colors hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50"
          >
            Details
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <p className="text-sm font-semibold">Hackathon ideas only</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Do not share company secrets, internal-only information, customer
            names, customer data, or anything you would not discuss in public.
          </p>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-label="Dismiss disclaimer"
        onClick={dismiss}
        className="ml-auto rounded p-1 text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
