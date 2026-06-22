"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CalendarX2,
  CheckCircle2,
  Clock3,
  Eye,
  RotateCcw,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import {
  useProductBase,
  useSelectedHackathon,
} from "@/components/ProductLayoutClient";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateTimeLocal(value: number) {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDeadline(value: string, timezone: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Choose a deadline";

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timezone,
      timeZoneName: "short",
    }).format(new Date(timestamp));
  } catch {
    return "Enter a valid timezone";
  }
}

export default function AdminIdeaDeadlinePage() {
  const hackathon = useSelectedHackathon();
  const productBase = useProductBase();
  const setting = useQuery(api.ideaSubmissions.getForAdmin, {
    hackathonId: hackathon?._id,
  });
  const saveSetting = useMutation(api.ideaSubmissions.save);
  const clearSetting = useMutation(api.ideaSubmissions.clear);
  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const [initialized, setInitialized] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState("");
  const [timezone, setTimezone] = useState(browserTimezone);
  const [message, setMessage] = useState(
    "The idea submission deadline has passed. Thanks for bringing your creativity here. You can still browse ideas, join teams, and keep the momentum going.",
  );
  const [active, setActive] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (setting === undefined || initialized) return;

    /* eslint-disable react-hooks/set-state-in-effect, @eslint-react/set-state-in-effect */
    if (setting) {
      setDeadlineAt(toDateTimeLocal(setting.deadlineAt));
      setTimezone(setting.timezone);
      setMessage(setting.message ?? "");
      setActive(setting.active);
    } else {
      const defaultDeadline = Date.now() + 24 * 60 * 60 * 1000;
      setDeadlineAt(toDateTimeLocal(defaultDeadline));
      setTimezone(browserTimezone);
      setActive(true);
    }
    setInitialized(true);
    /* eslint-enable react-hooks/set-state-in-effect, @eslint-react/set-state-in-effect */
  }, [browserTimezone, initialized, setting]);

  const preview = formatDeadline(deadlineAt, timezone);
  const parsedDeadline = new Date(deadlineAt).getTime();
  const isPast = Number.isFinite(parsedDeadline) && parsedDeadline <= now;
  const statusLabel = !active
    ? "Idea creation is open"
    : isPast
      ? "Idea creation is closed"
      : "Idea creation is open until the deadline";

  const handleSave = async () => {
    if (!Number.isFinite(parsedDeadline)) {
      toast.error("Choose a valid deadline");
      return;
    }

    setSaving(true);
    try {
      await saveSetting({
        hackathonId: hackathon?._id,
        deadlineAt: parsedDeadline,
        timezone,
        active,
        ...(message.trim() ? { message } : {}),
      });
      toast.success(active ? "Idea deadline saved" : "Idea creation resumed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      await clearSetting({ hackathonId: hackathon?._id });
      const defaultDeadline = Date.now() + 24 * 60 * 60 * 1000;
      setDeadlineAt(toDateTimeLocal(defaultDeadline));
      setTimezone(browserTimezone);
      setActive(true);
      toast.success("Idea creation resumed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resume");
    } finally {
      setResuming(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`${productBase}/admin`}
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <CalendarX2 className="h-6 w-6" />
              Idea Deadline
            </h1>
            <p className="text-sm text-muted-foreground">
              Close or reopen new idea submissions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {setting && (
            <Button
              variant="outline"
              onClick={handleResume}
              disabled={resuming}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {resuming ? "Resuming..." : "Resume now"}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !initialized}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {setting === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading deadline...</div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-5 rounded-lg border bg-background p-4 shadow-sm md:p-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="idea-deadline">Deadline</Label>
                <Input
                  id="idea-deadline"
                  type="datetime-local"
                  value={deadlineAt}
                  onChange={(event) => setDeadlineAt(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="idea-deadline-timezone">Timezone</Label>
                <Input
                  id="idea-deadline-timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  placeholder="Europe/Berlin"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="idea-deadline-message">Closed message</Label>
                <Textarea
                  id="idea-deadline-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={240}
                  rows={4}
                  placeholder="Tell participants what happens next."
                />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {message.length}/240
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActive((value) => !value)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition-colors ${
                active
                  ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Stop new ideas after this deadline
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
                    {active && isPast ? (
                      <CalendarX2 className="h-5 w-5" />
                    ) : (
                      <Clock3 className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Submission Status
                    </p>
                    <h2 className="break-words text-base font-semibold">
                      {statusLabel}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {preview}
                    </p>
                  </div>
                </div>

                {active && isPast && (
                  <p className="rounded-lg bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">
                    {message ||
                      "The idea submission deadline has passed. Thanks for bringing your creativity here."}
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
