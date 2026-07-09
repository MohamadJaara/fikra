import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "resume stale idea deletion jobs",
  { minutes: 5 },
  internal.ideaLifecycle.resumeStaleDeletionJobs,
);

export default crons;
