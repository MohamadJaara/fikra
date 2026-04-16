"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const statCards = [
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-3xl font-bold">{card.value}</p>
                  {card.subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {card.subtitle}
                    </p>
                  )}
                </div>
                <div className={`p-3 rounded-full ${card.bg}`}>
                  <span className={card.color}>{card.icon}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.totalIdeas > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ideas by Status</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/product/admin/users">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Manage Users</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalUsers} users registered
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/product/admin/ideas">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                  <Sparkles className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Manage Ideas</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalIdeas} ideas submitted
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/product/admin/categories">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950">
                  <Tags className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Manage Categories</p>
                  <p className="text-xs text-muted-foreground">
                    Idea categories
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/product/admin/comments">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Moderate Comments</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalComments} comments
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
