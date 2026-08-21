"use client";

import type { AppShellHackathon } from "@/components/AppShell";
import { motion } from "framer-motion";
import { CalendarClock } from "lucide-react";

function getTimeZoneLabel(value: number, timezone: string) {
  const parts = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    timeZone: timezone,
    timeZoneName: "short",
  }).formatToParts(new Date(value));

  return parts.find((part) => part.type === "timeZoneName")?.value ?? timezone;
}

function formatEventRange(
  startsAt: number,
  endsAt: number | undefined,
  timezone: string,
) {
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });

  const startDate = new Date(startsAt);
  const startDateLabel = dateFormatter.format(startDate);
  const startTimeLabel = timeFormatter.format(startDate);
  const timezoneLabel = getTimeZoneLabel(endsAt ?? startsAt, timezone);

  if (!endsAt) {
    return `${startDateLabel}, ${startTimeLabel} ${timezoneLabel}`;
  }

  const endDate = new Date(endsAt);
  const endDateLabel = dateFormatter.format(endDate);
  const endTimeLabel = timeFormatter.format(endDate);

  if (startDateLabel === endDateLabel) {
    return `${startDateLabel}, ${startTimeLabel} - ${endTimeLabel} ${timezoneLabel}`;
  }

  return `${startDateLabel}, ${startTimeLabel} - ${endDateLabel}, ${endTimeLabel} ${timezoneLabel}`;
}

function getRelativeLabel(
  startsAt: number,
  endsAt: number | undefined,
  completedAt: number | undefined,
) {
  if (completedAt !== undefined) {
    return "Done";
  }

  const now = Date.now();
  if (endsAt !== undefined && now >= startsAt && now <= endsAt) {
    return "Live now";
  }
  if (endsAt !== undefined && now > endsAt) {
    return "Ended";
  }

  const diff = startsAt - Date.now();
  const abs = Math.abs(diff);
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  if (diff < 0) return "Started";
  if (abs < hourMs) {
    const minutes = Math.max(1, Math.round(abs / (60 * 1000)));
    return `${minutes} min`;
  }
  if (abs < dayMs) {
    const hours = Math.round(abs / hourMs);
    return `${hours} hr`;
  }

  const days = Math.round(abs / dayMs);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function EventDateBanner({
  hackathon,
}: {
  hackathon: AppShellHackathon;
}) {
  if (hackathon === null) return null;

  const formattedDate = formatEventRange(
    hackathon.startsAt,
    hackathon.endsAt,
    hackathon.timezone,
  );
  const isComplete =
    hackathon.completedAt !== undefined || hackathon.status === "completed";
  const relativeLabel = getRelativeLabel(
    hackathon.startsAt,
    hackathon.endsAt,
    hackathon.completedAt,
  );
  const locationNote = [hackathon.location, hackathon.note]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="border-b bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--muted))_45%,hsl(var(--background))_100%)]"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2 md:px-6">
        <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="max-w-[10rem] truncate text-sm font-medium sm:max-w-[14rem]">
          {hackathon.title}
        </span>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {formattedDate}
        </span>
        {locationNote ? (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {locationNote}
          </span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            isComplete
              ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isComplete ? "bg-sky-500" : "bg-emerald-500"
            }`}
          />
          {relativeLabel}
        </span>
      </div>
    </motion.div>
  );
}
