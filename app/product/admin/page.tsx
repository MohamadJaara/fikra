"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  DoorOpen,
  Gauge,
  Heart,
  Lightbulb,
  MapPin,
  Megaphone,
  MessageSquare,
  Package,
  PackageCheck,
  Shield,
  ShieldCheck,
  Sparkles,
  Tags,
  UserCheck,
  UserPlus,
  Users,
  Vote,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useSelectedHackathon } from "@/components/ProductLayoutClient";
import {
  ROOM_REQUEST_LABELS,
  STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  TEAM_SIZE_LABELS,
} from "@/lib/constants";
import type { RoomRequestStatus, Status, TeamSize } from "@/lib/constants";

function formatPercent(value: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function widthPercent(value: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.min(100, Math.round((value / total) * 100))}%`;
}

export default function AdminDashboard() {
  const hackathon = useSelectedHackathon();
  const hackathonId = hackathon?._id;
  const adminBase = hackathon
    ? `/product/h/${hackathon.slug}/admin`
    : "/product/admin";
  const stats = useQuery(api.admin.stats, hackathonId ? { hackathonId } : {});

  if (stats === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading stats...</div>
      </div>
    );
  }

  const totalTeams = stats.teamFormation.forming + stats.teamFormation.formed;
  const decisionItems = [
    {
      title: "Teams Need Rooms",
      value: stats.roomOverview.queuedRoomRequests,
      subtitle: `${stats.roomOverview.assignedIdeas} already assigned`,
      href: `${adminBase}/ideas`,
      icon: <DoorOpen className="h-4 w-4" />,
      tone: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    },
    {
      title: "Ready, Not Queued",
      value: stats.roomOverview.readyTeamsMissingRoom,
      subtitle: "Formed teams without a room request",
      href: `${adminBase}/ideas`,
      icon: <AlertTriangle className="h-4 w-4" />,
      tone: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
    },
    {
      title: "Resource Blockers",
      value: stats.unresolvedResources,
      subtitle: `${stats.resourceNeeds.length} resource types requested`,
      href: `${adminBase}/resources`,
      icon: <Package className="h-4 w-4" />,
      tone: "border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
    },
    {
      title: "Still Forming",
      value: stats.teamFormation.forming,
      subtitle: `${formatPercent(stats.teamFormation.formed, totalTeams)} teams formed`,
      href: `${adminBase}/ideas`,
      icon: <UserPlus className="h-4 w-4" />,
      tone: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
    },
  ];

  const statItems = [
    {
      title: "Participants",
      value: stats.totalUsers,
      subtitle: `${stats.onboardedUsers} onboarded · ${stats.onsiteUsers} on-site · ${stats.remoteUsers} remote`,
      icon: <Users className="h-5 w-5" />,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Ideas",
      value: stats.totalIdeas,
      subtitle: `${stats.teamFormation.formed} teams done forming`,
      icon: <Lightbulb className="h-5 w-5" />,
      color: "text-yellow-600",
      bg: "bg-yellow-50 dark:bg-yellow-950",
    },
    {
      title: "Rooms",
      value: stats.roomOverview.totalRooms,
      subtitle: `${stats.roomOverview.availableTeamRooms} team rooms open · ${stats.roomOverview.sharedRooms} shared`,
      icon: <DoorOpen className="h-5 w-5" />,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950",
    },
    {
      title: "On-site Ideas",
      value: stats.roomOverview.onsiteOnlyIdeas,
      subtitle: `${stats.roomOverview.buildingWithoutRoom} building without rooms`,
      icon: <MapPin className="h-5 w-5" />,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950",
    },
    {
      title: "Interest",
      value: stats.totalInterest,
      subtitle: `${stats.totalMembers} team memberships`,
      icon: <Heart className="h-5 w-5" />,
      color: "text-pink-600",
      bg: "bg-pink-50 dark:bg-pink-950",
    },
    {
      title: "Discussion",
      value: stats.totalComments,
      subtitle: `${stats.totalReactions} reactions`,
      icon: <MessageSquare className="h-5 w-5" />,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950",
    },
  ];

  const navItems = [
    {
      href: `${adminBase}/users`,
      icon: <UserCheck className="h-5 w-5 text-blue-600" />,
      bg: "bg-blue-50 dark:bg-blue-950",
      title: "Manage Users",
      subtitle: `${stats.totalUsers} users registered`,
    },
    {
      href: `${adminBase}/ideas`,
      icon: <Sparkles className="h-5 w-5 text-yellow-600" />,
      bg: "bg-yellow-50 dark:bg-yellow-950",
      title: "Ideas & Rooms",
      subtitle: `${stats.totalIdeas} ideas · ${stats.roomOverview.totalRooms} rooms`,
    },
    {
      href: `${adminBase}/categories`,
      icon: <Tags className="h-5 w-5 text-purple-600" />,
      bg: "bg-purple-50 dark:bg-purple-950",
      title: "Manage Categories",
      subtitle: "Idea categories",
    },
    {
      href: `${adminBase}/roles`,
      icon: <ShieldCheck className="h-5 w-5 text-orange-600" />,
      bg: "bg-orange-50 dark:bg-orange-950",
      title: "Manage Roles",
      subtitle: "User and team roles",
    },
    {
      href: `${adminBase}/resources`,
      icon: <Package className="h-5 w-5 text-cyan-600" />,
      bg: "bg-cyan-50 dark:bg-cyan-950",
      title: "Manage Resources",
      subtitle: "Resource request options",
    },
    {
      href: `${adminBase}/comments`,
      icon: <MessageSquare className="h-5 w-5 text-green-600" />,
      bg: "bg-green-50 dark:bg-green-950",
      title: "Moderate Comments",
      subtitle: `${stats.totalComments} comments`,
    },
    {
      href: `${adminBase}/announcements`,
      icon: <Megaphone className="h-5 w-5 text-fuchsia-600" />,
      bg: "bg-fuchsia-50 dark:bg-fuchsia-950",
      title: "Announcements",
      subtitle: "Broadcast to all users",
    },
    {
      href: `${adminBase}/hackathons`,
      icon: <CalendarDays className="h-5 w-5 text-sky-600" />,
      bg: "bg-sky-50 dark:bg-sky-950",
      title: "Hackathons",
      subtitle: "Create and manage events",
    },
    {
      href: `${adminBase}/event`,
      icon: <CalendarClock className="h-5 w-5 text-emerald-600" />,
      bg: "bg-emerald-50 dark:bg-emerald-950",
      title: "Event Date",
      subtitle: "Set the visible hackathon date",
    },
    {
      href: `${adminBase}/idea-deadline`,
      icon: <CalendarX2 className="h-5 w-5 text-amber-600" />,
      bg: "bg-amber-50 dark:bg-amber-950",
      title: "Idea Deadline",
      subtitle: "Close or reopen new submissions",
    },
    {
      href: `${adminBase}/voting`,
      icon: <Vote className="h-5 w-5 text-rose-600" />,
      bg: "bg-rose-50 dark:bg-rose-950",
      title: "Voting",
      subtitle: "Start voting and view results",
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Hackathon overview for teams, rooms, roles, and blockers
          </p>
        </div>
        <Button asChild size="sm" className="gap-2 sm:mt-1">
          <Link href="/product/admin/ideas">
            <DoorOpen className="h-4 w-4" />
            Ideas & Rooms
          </Link>
        </Button>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Decision Queue</h2>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {decisionItems.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="bg-background p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-3">
                <Badge variant="outline" className={`gap-1.5 ${item.tone}`}>
                  {item.icon}
                  {item.title}
                </Badge>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <p className="mt-4 text-3xl font-bold leading-none">
                {item.value}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {item.subtitle}
              </p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {statItems.map((item) => (
          <div key={item.title} className="py-2">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${item.bg}`}>
                <span className={item.color}>{item.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{item.title}</p>
                <p className="text-2xl font-bold">{item.value}</p>
              </div>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">
              {item.subtitle}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Teams And Rooms</h2>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/product/admin/ideas">
                <ClipboardList className="h-4 w-4" />
                Manage
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4">
            <div className="bg-background p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Formed
              </div>
              <p className="mt-2 text-2xl font-bold">
                {stats.teamFormation.formed}
              </p>
            </div>
            <div className="bg-background p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CircleDashed className="h-3.5 w-3.5 text-blue-600" />
                Forming
              </div>
              <p className="mt-2 text-2xl font-bold">
                {stats.teamFormation.forming}
              </p>
            </div>
            <div className="bg-background p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <DoorOpen className="h-3.5 w-3.5 text-indigo-600" />
                Assigned
              </div>
              <p className="mt-2 text-2xl font-bold">
                {stats.roomOverview.assignedIdeas}
              </p>
            </div>
            <div className="bg-background p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <PackageCheck className="h-3.5 w-3.5 text-teal-600" />
                Open Rooms
              </div>
              <p className="mt-2 text-2xl font-bold">
                {stats.roomOverview.availableTeamRooms}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            {stats.topIdeasNeedingRooms.length === 0 ? (
              <div className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                No formed teams are waiting on room decisions.
              </div>
            ) : (
              stats.topIdeasNeedingRooms.map((idea) => (
                <Link
                  key={idea._id}
                  href={`/product/ideas/${idea._id}`}
                  className="flex flex-col gap-3 border-b p-4 transition-colors last:border-b-0 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{idea.title}</p>
                      <Badge
                        variant="outline"
                        className={
                          idea.roomRequestStatus === "requested"
                            ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : ""
                        }
                      >
                        {
                          ROOM_REQUEST_LABELS[
                            idea.roomRequestStatus as RoomRequestStatus
                          ]
                        }
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {idea.ownerName} · {idea.memberCount} member
                      {idea.memberCount === 1 ? "" : "s"} · target{" "}
                      {TEAM_SIZE_LABELS[idea.teamSize as TeamSize]}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {idea.missingRoles.length > 0 && (
                      <Badge variant="secondary">
                        {idea.missingRoles.length} role gap
                      </Badge>
                    )}
                    {idea.unresolvedResources > 0 && (
                      <Badge variant="secondary">
                        {idea.unresolvedResources} resource
                      </Badge>
                    )}
                    <ArrowRight className="hidden h-4 w-4 sm:block" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Role Pressure</h2>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/product/admin/roles">
                <ShieldCheck className="h-4 w-4" />
                Roles
              </Link>
            </Button>
          </div>

          <div className="rounded-lg border">
            {stats.roleGaps.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No role demand yet.
              </div>
            ) : (
              stats.roleGaps.map((role) => {
                const barTotal = Math.max(role.needed, role.availableUsers, 1);
                return (
                  <div key={role.slug} className="border-b p-4 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {role.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {role.missing} missing · {role.availableUsers} people
                        </p>
                      </div>
                      {role.gap > 0 ? (
                        <Badge variant="outline" className="shrink-0">
                          gap {role.gap}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          covered
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: widthPercent(role.missing, barTotal) }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Resource Needs</h2>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/product/admin/resources">
                <PackageCheck className="h-4 w-4" />
                Resources
              </Link>
            </Button>
          </div>
          <div className="rounded-lg border">
            {stats.resourceNeeds.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No unresolved resource requests.
              </div>
            ) : (
              stats.resourceNeeds.map((resource) => (
                <div
                  key={resource.slug}
                  className="flex items-center justify-between gap-3 border-b p-4 last:border-b-0"
                >
                  <p className="truncate text-sm font-medium">
                    {resource.name}
                  </p>
                  <Badge variant="outline">{resource.count} open</Badge>
                </div>
              ))
            )}
          </div>
        </section>

        {stats.totalIdeas > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Ideas By Status</h2>
            </div>
            <div className="flex flex-wrap gap-3 rounded-lg border p-4">
              {STATUSES.map((status) => {
                const count = stats.ideasByStatus[status] || 0;
                return (
                  <Badge
                    key={status}
                    variant="outline"
                    className={`px-3 py-1 text-sm ${STATUS_COLORS[status as Status]}`}
                  >
                    {STATUS_LABELS[status as Status]}: {count}
                  </Badge>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Management</h2>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2 lg:grid-cols-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 bg-background px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className={`rounded-lg p-2 ${item.bg}`}>{item.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.subtitle}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
