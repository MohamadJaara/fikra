import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getHackathonByIdOrCurrent } from "./lib";
import type { Doc, Id } from "./_generated/dataModel";

type IdeaSubmissionCtx = QueryCtx | MutationCtx;
type SubmissionClosedReason = "started" | "completed" | "archived";
type HackathonForSubmission = Pick<
  Doc<"hackathons">,
  "_id" | "title" | "startsAt" | "timezone" | "status" | "completedAt"
>;

function localDateParts(timestamp: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));

  return {
    year: parts.find((part) => part.type === "year")?.value ?? "0000",
    month: parts.find((part) => part.type === "month")?.value ?? "00",
    day: parts.find((part) => part.type === "day")?.value ?? "00",
  };
}

function localDateKey(timestamp: number, timezone: string) {
  try {
    const { year, month, day } = localDateParts(timestamp, timezone);
    return `${year}-${month}-${day}`;
  } catch {
    const { year, month, day } = localDateParts(timestamp, "UTC");
    return `${year}-${month}-${day}`;
  }
}

function formatStartDay(timestamp: number, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeZone: timezone,
    }).format(new Date(timestamp));
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeZone: "UTC",
    }).format(new Date(timestamp));
  }
}

function firstDayHasStarted(
  hackathon: Pick<Doc<"hackathons">, "startsAt" | "timezone">,
  now: number,
) {
  return (
    localDateKey(now, hackathon.timezone) >=
    localDateKey(hackathon.startsAt, hackathon.timezone)
  );
}

function closedMessage(
  hackathon: HackathonForSubmission,
  reason: SubmissionClosedReason,
) {
  if (reason === "archived") {
    return `${hackathon.title} is archived, so new ideas are closed. You can still browse ideas, join teams, and keep building from here.`;
  }

  if (reason === "completed") {
    return `${hackathon.title} is marked done, so new ideas are closed. You can still browse ideas, join teams, and keep the momentum going.`;
  }

  return `The first day of ${hackathon.title} started on ${formatStartDay(
    hackathon.startsAt,
    hackathon.timezone,
  )}. New ideas are closed, but you can still browse ideas, join teams, and keep building from here.`;
}

export function getIdeaSubmissionWindow(
  hackathon: HackathonForSubmission | null,
  now = Date.now(),
) {
  if (!hackathon) {
    return {
      isOpen: true,
      hackathonId: null,
      hackathonTitle: null,
      startsAt: null,
      timezone: null,
      reason: null,
      message: null,
    };
  }

  let reason: SubmissionClosedReason | null = null;
  if (hackathon.status === "archived") {
    reason = "archived";
  } else if (
    hackathon.status === "completed" ||
    hackathon.completedAt !== undefined
  ) {
    reason = "completed";
  } else if (firstDayHasStarted(hackathon, now)) {
    reason = "started";
  }

  return {
    isOpen: reason === null,
    hackathonId: hackathon._id,
    hackathonTitle: hackathon.title,
    startsAt: hackathon.startsAt,
    timezone: hackathon.timezone,
    reason,
    message: reason ? closedMessage(hackathon, reason) : null,
  };
}

export function assertIdeaSubmissionsOpenForHackathon(
  hackathon: HackathonForSubmission | null,
) {
  const window = getIdeaSubmissionWindow(hackathon);
  if (window.isOpen) return;

  throw new Error(window.message ?? "Idea submissions are closed");
}

export async function assertIdeaSubmissionsOpen(
  ctx: IdeaSubmissionCtx,
  hackathonId?: Id<"hackathons">,
) {
  const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
  assertIdeaSubmissionsOpenForHackathon(hackathon);
}

export const getCurrent = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAuthenticatedUser(ctx);

    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    return getIdeaSubmissionWindow(hackathon);
  },
});
