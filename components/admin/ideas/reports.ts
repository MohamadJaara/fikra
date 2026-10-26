import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { STATUSES, STATUS_LABELS, type Status } from "@/lib/constants";

type IdeasReport = FunctionReturnType<typeof api.admin.ideasReport>;

function formatReportDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function tableCell(value: string | number | boolean | undefined) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

function reportIdeaLine(idea: IdeasReport["ideas"][number]) {
  const room = idea.roomName
    ? `${idea.roomName}${idea.roomType ? ` (${idea.roomType})` : ""}`
    : "No room";
  return [
    tableCell(idea.title),
    tableCell(idea.ownerName),
    tableCell(STATUS_LABELS[idea.status as Status] ?? idea.status),
    tableCell(idea.memberCount),
    tableCell(room),
    tableCell(idea.roomRequestStatus),
    tableCell(idea.unresolvedResources),
    tableCell(idea.interest),
  ].join(" | ");
}

function decisionList(
  title: string,
  ideas: IdeasReport["ideas"],
  emptyText: string,
) {
  const rows = ideas.slice(0, 10);
  return [
    `### ${title}`,
    rows.length === 0
      ? emptyText
      : rows
          .map((idea) => {
            const roomText = idea.roomName ? `, room: ${idea.roomName}` : "";
            const roleText =
              idea.missingRoles.length > 0
                ? `, missing: ${idea.missingRoles.join(", ")}`
                : "";
            return `- ${idea.title} (${idea.ownerName}, ${idea.memberCount} members${roomText}${roleText})`;
          })
          .join("\n"),
  ].join("\n\n");
}

export function buildIdeasReportMarkdown(report: IdeasReport) {
  const { summary } = report;
  const assignedPercent =
    summary.totalIdeas === 0
      ? 0
      : Math.round((summary.assignedIdeas / summary.totalIdeas) * 100);
  const activePercent =
    summary.totalIdeas === 0
      ? 0
      : Math.round((summary.activeIdeas / summary.totalIdeas) * 100);
  const updateBullets = [
    `${summary.activeIdeas}/${summary.totalIdeas} ideas are active (${activePercent}%).`,
    `${summary.assignedIdeas}/${summary.totalIdeas} ideas have rooms assigned (${assignedPercent}%).`,
    `${summary.roomRequests} ideas are waiting for room assignment.`,
    `${summary.shelvedIdeas} ideas are shelved.`,
    `${summary.resourceBlockedIdeas} active ideas have unresolved resource blockers.`,
  ];

  return [
    "# Fikra Ideas Report",
    `Generated ${formatReportDate(report.generatedAt)}`,
    "",
    "## Executive Summary",
    `- Total ideas: ${summary.totalIdeas}`,
    `- Active vs shelved: ${summary.activeIdeas} active, ${summary.shelvedIdeas} shelved`,
    `- Rooms: ${summary.assignedIdeas} assigned, ${summary.unassignedIdeas} unassigned`,
    `- Room pressure: ${summary.roomRequests} waiting, ${summary.readyWithoutRoomRequest} ready but not queued`,
    `- Blockers: ${summary.resourceBlockedIdeas} ideas with unresolved resources`,
    `- Activity: ${summary.totalComments} comments, ${summary.totalReactions} reactions, ${summary.totalInterest} interest signals`,
    "",
    "## Update-Ready Bullets",
    updateBullets.map((line) => `- ${line}`).join("\n"),
    "",
    "## Status Breakdown",
    "| Status | Count |",
    "| --- | ---: |",
    ...STATUSES.map(
      (status) =>
        `| ${tableCell(STATUS_LABELS[status])} | ${summary.byStatus[status] ?? 0} |`,
    ),
    "",
    "## Decision Queues",
    decisionList(
      "Assign Rooms",
      report.decisionQueues.roomRequests,
      "No ideas are currently waiting for room assignment.",
    ),
    "",
    decisionList(
      "Ready But Not Queued",
      report.decisionQueues.readyWithoutRoomRequest,
      "No ready teams are missing room requests.",
    ),
    "",
    decisionList(
      "Building Without Room",
      report.decisionQueues.buildingWithoutRoom,
      "No building ideas are missing rooms.",
    ),
    "",
    decisionList(
      "Resource Blockers",
      report.decisionQueues.resourceBlocked,
      "No active ideas have unresolved resource blockers.",
    ),
    "",
    decisionList(
      "Shelved Ideas",
      report.decisionQueues.shelvedIdeas,
      "No ideas are shelved.",
    ),
    "",
    "## Room Usage",
    "| Room | Type | Limit | Assigned | Ideas |",
    "| --- | --- | ---: | ---: | --- |",
    ...report.roomUsage.map(
      (room) =>
        `| ${tableCell(room.name)} | ${tableCell(room.type)} | ${tableCell(room.assignmentLimit ?? (room.type === "shared" ? "No limit" : 1))} | ${room.assignedIdeas} | ${tableCell(room.assignedIdeaTitles.join(", "))} |`,
    ),
    "",
    "## Idea Table",
    "| Idea | Owner | Status | Members | Room | Room State | Resources | Interest |",
    "| --- | --- | --- | ---: | --- | --- | ---: | ---: |",
    ...report.ideas.map(reportIdeaLine),
    "",
  ].join("\n");
}
