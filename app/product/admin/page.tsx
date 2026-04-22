"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Lightbulb,
  MessageSquare,
  Heart,
  Sparkles,
  ArrowRight,
  Shield,
  UserCheck,
  Tags,
  ShieldCheck,
  DoorOpen,
  Package,
} from "lucide-react";
import Link from "next/link";
import { STATUSES, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";

export default function AdminDashboard() {
  const stats = useQuery(api.admin.stats);

  if (stats === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading stats...</div>
      </div>
    );
  }

  const statItems = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      subtitle: `${stats.onboardedUsers} onboarded`,
      icon: <Users className="h-5 w-5" />,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Ideas",
      value: stats.totalIdeas,
      subtitle: Object.entries(stats.ideasByStatus)
        .map(
          ([s, c]) =>
            `${STATUS_LABELS[s as keyof typeof STATUS_LABELS] || s}: ${c}`,
        )
        .join(", "),
      icon: <Lightbulb className="h-5 w-5" />,
      color: "text-yellow-600",
      bg: "bg-yellow-50 dark:bg-yellow-950",
    },
    {
      title: "Comments",
      value: stats.totalComments,
      icon: <MessageSquare className="h-5 w-5" />,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Reactions",
      value: stats.totalReactions,
      icon: <Heart className="h-5 w-5" />,
      color: "text-pink-600",
      bg: "bg-pink-50 dark:bg-pink-950",
    },
  ];

  const navItems = [
    {
      href: "/product/admin/users",
      icon: <UserCheck className="h-5 w-5 text-blue-600" />,
      bg: "bg-blue-50 dark:bg-blue-950",
      title: "Manage Users",
      subtitle: `${stats.totalUsers} users registered`,
    },
    {
      href: "/product/admin/ideas",
      icon: <Sparkles className="h-5 w-5 text-yellow-600" />,
      bg: "bg-yellow-50 dark:bg-yellow-950",
      title: "Manage Ideas",
      subtitle: `${stats.totalIdeas} ideas submitted`,
    },
    {
      href: "/product/admin/categories",
      icon: <Tags className="h-5 w-5 text-purple-600" />,
      bg: "bg-purple-50 dark:bg-purple-950",
      title: "Manage Categories",
      subtitle: "Idea categories",
    },
    {
      href: "/product/admin/roles",
      icon: <ShieldCheck className="h-5 w-5 text-orange-600" />,
      bg: "bg-orange-50 dark:bg-orange-950",
      title: "Manage Roles",
      subtitle: "User & team roles",
    },
    {
      href: "/product/admin/resources",
      icon: <Package className="h-5 w-5 text-cyan-600" />,
      bg: "bg-cyan-50 dark:bg-cyan-950",
      title: "Manage Resources",
      subtitle: "Resource request options",
    },
    {
      href: "/product/admin/rooms",
      icon: <DoorOpen className="h-5 w-5 text-indigo-600" />,
      bg: "bg-indigo-50 dark:bg-indigo-950",
      title: "Manage Rooms",
      subtitle: "Assign rooms to ideas",
    },
    {
      href: "/product/admin/comments",
      icon: <MessageSquare className="h-5 w-5 text-green-600" />,
      bg: "bg-green-50 dark:bg-green-950",
      title: "Moderate Comments",
      subtitle: `${stats.totalComments} comments`,
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Admin Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Overview of your hackathon idea board
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((item) => (
          <div key={item.title} className="py-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${item.bg}`}>
                <span className={item.color}>{item.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{item.title}</p>
                <p className="text-2xl font-bold">{item.value}</p>
              </div>
            </div>
            {item.subtitle && (
              <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                {item.subtitle}
              </p>
            )}
          </div>
        ))}
      </div>

      {stats.totalIdeas > 0 && (
        <div className="py-3">
          <h2 className="text-sm font-semibold mb-3">Ideas by Status</h2>
          <div className="flex flex-wrap gap-3">
            {STATUSES.map((status) => {
              const count = stats.ideasByStatus[status] || 0;
              return (
                <Badge
                  key={status}
                  variant="outline"
                  className={`text-sm px-3 py-1 ${STATUS_COLORS[status]}`}
                >
                  {STATUS_LABELS[status]}: {count}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-3">Management</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3.5 bg-background hover:bg-muted/50 transition-colors"
            >
              <div className={`p-2 rounded-lg ${item.bg}`}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.subtitle}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
