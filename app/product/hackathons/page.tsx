"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { useProductViewer } from "@/components/ProductLayoutClient";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Settings,
} from "lucide-react";
import Link from "next/link";

type HackathonItem = NonNullable<
  FunctionReturnType<typeof api.hackathons.list>
>[number];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200",
  upcoming:
    "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  active:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  completed:
    "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200",
  archived:
    "border-stone-300 bg-stone-50 text-stone-700 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-200",
};

function formatDateRange(hackathon: HackathonItem) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: hackathon.timezone,
  });
  const start = formatter.format(new Date(hackathon.startsAt));
  if (!hackathon.endsAt) return start;
  return `${start} - ${formatter.format(new Date(hackathon.endsAt))}`;
}

function statusIcon(status: string) {
  if (status === "active") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "completed") return <Clock3 className="h-4 w-4" />;
  return <CalendarDays className="h-4 w-4" />;
}

function HackathonCard({
  hackathon,
  currentId,
}: {
  hackathon: HackathonItem;
  currentId?: string;
}) {
  const isCurrent = hackathon._id === currentId;

  return (
    <Link
      href={`/product/h/${hackathon.slug}`}
      className="group flex flex-col gap-4 rounded-lg border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">
            {hackathon.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDateRange(hackathon)}
            </span>
            {hackathon.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {hackathon.location}
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn("gap-1", STATUS_STYLES[hackathon.status])}
        >
          {statusIcon(hackathon.status)}
          {STATUS_LABELS[hackathon.status] ?? hackathon.status}
        </Badge>
        {isCurrent && <Badge variant="secondary">Current</Badge>}
      </div>
      {hackathon.note && (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {hackathon.note}
        </p>
      )}
    </Link>
  );
}

export default function HackathonsPage() {
  const viewer = useProductViewer();
  const hackathons = useQuery(api.hackathons.list, {});
  const current = useQuery(api.hackathons.getCurrent, {});

  if (hackathons === undefined || current === undefined) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="h-8 w-48 animate-pulse rounded bg-muted/50" />
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="h-40 animate-pulse rounded-lg bg-muted/40" />
          <div className="h-40 animate-pulse rounded-lg bg-muted/40" />
        </div>
      </div>
    );
  }

  const active = hackathons.filter((h) => h.status === "active");
  const upcoming = hackathons.filter(
    (h) => h.status === "upcoming" || h.status === "draft",
  );
  const completed = hackathons.filter((h) => h.status === "completed");

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hackathons</h1>
          <p className="text-sm text-muted-foreground">
            Active, upcoming, and previous events
          </p>
        </div>
        {viewer.isAdmin && (
          <Button asChild variant="outline">
            <Link href="/product/admin/hackathons">
              <Settings className="h-4 w-4 mr-2" />
              Manage
            </Link>
          </Button>
        )}
      </div>

      <HackathonSection
        title="Active"
        empty="No active hackathon"
        hackathons={active}
        currentId={current?._id}
      />
      <HackathonSection
        title="Upcoming"
        empty="No upcoming hackathons"
        hackathons={upcoming}
        currentId={current?._id}
      />
      <HackathonSection
        title="Previous"
        empty="No previous hackathons"
        hackathons={completed}
        currentId={current?._id}
      />
    </div>
  );
}

function HackathonSection({
  title,
  empty,
  hackathons,
  currentId,
}: {
  title: string;
  empty: string;
  hackathons: HackathonItem[];
  currentId?: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-normal text-muted-foreground">
        {title}
      </h2>
      {hackathons.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {hackathons.map((hackathon) => (
            <HackathonCard
              key={hackathon._id}
              hackathon={hackathon}
              currentId={currentId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
