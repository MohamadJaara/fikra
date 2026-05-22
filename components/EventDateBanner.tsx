"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { CalendarClock, MapPin, Timer } from "lucide-react";

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

function getRelativeLabel(startsAt: number, endsAt: number | undefined) {
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

export function EventDateBanner() {
  const event = useQuery(api.event.getCurrent);

  if (event === undefined || event === null) return null;

  const formattedDate = formatEventRange(
    event.startsAt,
    event.endsAt,
    event.timezone,
  );
  const relativeLabel = getRelativeLabel(event.startsAt, event.endsAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="border-b bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--muted))_45%,hsl(var(--background))_100%)]"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background shadow-sm">
            <CalendarClock className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Event Dates
            </p>
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <h2 className="truncate text-base font-semibold leading-tight">
                {event.title}
              </h2>
              <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/40 sm:block" />
              <p className="text-sm font-medium text-foreground/80">
                {formattedDate}
              </p>
            </div>
            {(event.location || event.note) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {event.location && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </span>
                )}
                {event.note && (
                  <span className="break-words">{event.note}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-lg border bg-background/70 px-3 py-2 text-sm shadow-sm">
          <Timer className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold">{relativeLabel}</span>
        </div>
      </div>
    </motion.div>
  );
}
