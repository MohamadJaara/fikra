"use client";

import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { Megaphone, AlertTriangle, PartyPopper, X } from "lucide-react";
import { useState, type MouseEvent } from "react";

const TYPE_CONFIG = {
  info: {
    icon: Megaphone,
    gradient:
      "bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 dark:from-indigo-500 dark:via-blue-500 dark:to-violet-500",
    shimmer: "from-white/0 via-white/25 to-white/0",
    glow: "shadow-indigo-500/25 dark:shadow-indigo-400/20",
  },
  urgent: {
    icon: AlertTriangle,
    gradient:
      "bg-gradient-to-r from-rose-600 via-red-600 to-orange-600 dark:from-rose-500 dark:via-red-500 dark:to-orange-500",
    shimmer: "from-white/0 via-white/30 to-white/0",
    glow: "shadow-red-500/30 dark:shadow-red-400/25",
  },
  celebration: {
    icon: PartyPopper,
    gradient:
      "bg-gradient-to-r from-amber-500 via-yellow-500 to-emerald-500 dark:from-amber-400 dark:via-yellow-400 dark:to-emerald-400",
    shimmer: "from-white/0 via-white/30 to-white/0",
    glow: "shadow-amber-500/25 dark:shadow-amber-400/20",
  },
} as const;

type AnnouncementType = keyof typeof TYPE_CONFIG;

export function AnnouncementBanner() {
  const announcements = useQuery(api.announcements.getActive);
  const dismiss = useMutation(api.announcements.dismiss);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  if (announcements === undefined || announcements.length === 0) return null;

  const visible = announcements.filter((a) => !dismissedIds.has(a._id));
  if (visible.length === 0) return null;

  const announcement = visible[0];
  const config = TYPE_CONFIG[announcement.type as AnnouncementType] ?? TYPE_CONFIG.info;
  const Icon = config.icon;

  const handleDismiss = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setDismissedIds((prev) => new Set(prev).add(announcement._id));
    setOpen(false);
    void dismiss({ announcementId: announcement._id });
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden"
        >
          <div
            className={`relative ${config.gradient} shadow-lg ${config.glow}`}
          >
            <div
              onClick={() => setOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setOpen(true);
                }
              }}
              role="button"
              tabIndex={0}
              className="relative z-10 mx-auto flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent md:px-6"
            >
              <motion.div
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 15,
                  delay: 0.15,
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
              >
                <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </motion.div>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                <motion.p
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="min-w-0 break-words text-sm font-semibold text-white"
                >
                  {announcement.title}
                </motion.p>
                <span className="hidden shrink-0 text-white/50 sm:inline">
                  ·
                </span>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="hidden min-w-0 flex-1 truncate text-sm text-white/85 sm:block"
                >
                  {announcement.message}
                </motion.p>
              </div>

              <motion.span
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="hidden shrink-0 text-xs font-medium text-white/70 md:inline"
              >
                View
              </motion.span>

              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25, type: "spring", stiffness: 300 }}
                onClick={handleDismiss}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/80 transition-colors backdrop-blur-sm hover:bg-white/25 hover:text-white"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </motion.button>
            </div>

            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{
                  duration: 2.5,
                  ease: "easeInOut",
                  delay: 0.5,
                  repeat: Infinity,
                  repeatDelay: 4,
                }}
                className={`absolute inset-y-0 w-1/3 bg-gradient-to-r ${config.shimmer} skew-x-[-20deg]`}
              />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <div
              className={`mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${config.gradient}`}
            >
              <Icon className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <DialogTitle className="break-words leading-snug">
              {announcement.title}
            </DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
            {announcement.message}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
