import { ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

type ContentDisclaimerProps = {
  className?: string;
};

export function ContentDisclaimer({
  className,
}: ContentDisclaimerProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Hackathon ideas only</p>
          <p className="text-sm leading-6 text-amber-900/90 dark:text-amber-100/90">
            Do not share company secrets, internal-only information, customer
            names, customer data, or anything you would not discuss in public.
          </p>
        </div>
      </div>
    </div>
  );
}
