"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Eye,
  MapPin,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateTimeLocal(value: number) {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getTimeZoneLabel(value: number, timezone: string) {
  const parts = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    timeZone: timezone,
    timeZoneName: "short",
  }).formatToParts(new Date(value));

  return parts.find((part) => part.type === "timeZoneName")?.value ?? timezone;
}

function formatPreview(startValue: string, endValue: string, timezone: string) {
  const startTimestamp = new Date(startValue).getTime();
  if (!Number.isFinite(startTimestamp)) return "Choose a start date and time";

  try {
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: timezone,
    });
    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    });

    const startDate = new Date(startTimestamp);
    const startDateLabel = dateFormatter.format(startDate);
    const startTimeLabel = timeFormatter.format(startDate);
    const endTimestamp = endValue ? new Date(endValue).getTime() : NaN;

    if (!Number.isFinite(endTimestamp)) {
      return `${startDateLabel}, ${startTimeLabel} ${getTimeZoneLabel(startTimestamp, timezone)}`;
    }

    const endDate = new Date(endTimestamp);
    const endDateLabel = dateFormatter.format(endDate);
    const endTimeLabel = timeFormatter.format(endDate);
    const timezoneLabel = getTimeZoneLabel(endTimestamp, timezone);

    if (startDateLabel === endDateLabel) {
      return `${startDateLabel}, ${startTimeLabel} - ${endTimeLabel} ${timezoneLabel}`;
    }

    return `${startDateLabel}, ${startTimeLabel} - ${endDateLabel}, ${endTimeLabel} ${timezoneLabel}`;
  } catch {
    return "Enter a valid timezone";
  }
}

export default function AdminEventPage() {
  const event = useQuery(api.event.getForAdmin);
  const saveEvent = useMutation(api.event.save);
  const clearEvent = useMutation(api.event.clear);
  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const [initialized, setInitialized] = useState(false);
  const [title, setTitle] = useState("Hackathon kickoff");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [timezone, setTimezone] = useState(browserTimezone);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (event === undefined || initialized) return;

    /* eslint-disable react-hooks/set-state-in-effect, @eslint-react/set-state-in-effect */
    if (event) {
      setTitle(event.title);
      setStartsAt(toDateTimeLocal(event.startsAt));
      setEndsAt(event.endsAt ? toDateTimeLocal(event.endsAt) : "");
      setTimezone(event.timezone);
      setLocation(event.location ?? "");
      setNote(event.note ?? "");
      setActive(event.active);
    } else {
      const defaultStart = Date.now() + 7 * 24 * 60 * 60 * 1000;
      setStartsAt(toDateTimeLocal(defaultStart));
      setEndsAt(toDateTimeLocal(defaultStart + 8 * 60 * 60 * 1000));
      setTimezone(browserTimezone);
    }
    setInitialized(true);
    /* eslint-enable react-hooks/set-state-in-effect, @eslint-react/set-state-in-effect */
  }, [browserTimezone, event, initialized]);

  const preview = formatPreview(startsAt, endsAt, timezone);

  const handleSave = async () => {
    const startTimestamp = new Date(startsAt).getTime();
    const endTimestamp = endsAt ? new Date(endsAt).getTime() : undefined;
    if (!Number.isFinite(startTimestamp)) {
      toast.error("Choose a valid start date");
      return;
    }
    if (endTimestamp !== undefined && !Number.isFinite(endTimestamp)) {
      toast.error("Choose a valid end date");
      return;
    }
    if (endTimestamp !== undefined && endTimestamp <= startTimestamp) {
      toast.error("End date must be after the start date");
      return;
    }

    setSaving(true);
    try {
      await saveEvent({
        title,
        startsAt: startTimestamp,
        ...(endTimestamp !== undefined ? { endsAt: endTimestamp } : {}),
        timezone,
        active,
        ...(location.trim() ? { location } : {}),
        ...(note.trim() ? { note } : {}),
      });
      toast.success("Event date saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear the event date? Users will no longer see it.")) return;

    try {
      await clearEvent();
      setTitle("Hackathon kickoff");
      const defaultStart = Date.now() + 7 * 24 * 60 * 60 * 1000;
      setStartsAt(toDateTimeLocal(defaultStart));
      setEndsAt(toDateTimeLocal(defaultStart + 8 * 60 * 60 * 1000));
      setTimezone(browserTimezone);
      setLocation("");
      setNote("");
      setActive(true);
      toast.success("Event date cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/product/admin"
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <CalendarClock className="h-6 w-6" />
              Event Date
            </h1>
            <p className="text-sm text-muted-foreground">
              Set the main date shown across the product.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {event && (
            <Button variant="outline" onClick={handleClear}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !initialized}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {event === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading event date...</div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-5 rounded-lg border bg-background p-4 shadow-sm md:p-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="event-title">Title</Label>
                <Input
                  id="event-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={80}
                  placeholder="Hackathon kickoff"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-start">From</Label>
                <Input
                  id="event-start"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-end">To</Label>
                <Input
                  id="event-end"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-timezone">Timezone</Label>
                <Input
                  id="event-timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  placeholder="Europe/Berlin"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-location">Location</Label>
                <Input
                  id="event-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  maxLength={120}
                  placeholder="Main hall"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="event-note">Note</Label>
                <Textarea
                  id="event-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={240}
                  rows={3}
                  placeholder="Doors open 30 minutes early."
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActive((value) => !value)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition-colors ${
                active
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Visible to users
              </span>
              <span className="text-xs">{active ? "On" : "Off"}</span>
            </button>
          </div>

          <aside className="space-y-3">
            <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
              <div className="border-b bg-muted/40 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Eye className="h-4 w-4" />
                  Preview
                </p>
              </div>
              <div className="space-y-4 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Event Dates
                    </p>
                    <h2 className="break-words text-base font-semibold">
                      {title || "Untitled event"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {preview}
                    </p>
                  </div>
                </div>

                {location && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {location}
                  </p>
                )}
                {note && (
                  <p className="rounded-lg bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">
                    {note}
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      <Toaster />
    </div>
  );
}
