"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IdeaListSkeleton } from "@/components/Skeleton";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type Status,
} from "@/lib/constants";
import type { UnresolvedResource } from "@/lib/types";
import { Users, Lightbulb, Heart, Package } from "lucide-react";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

export default function ActivityPage() {
  const createdIdeas = useQuery(api.ideas.getByOwner) as
    | {
        _id: Id<"ideas">;
        title: string;
        pitch: string;
        status: string;
        _creationTime: number;
      }[]
    | undefined;
  const joinedIdeas = useQuery(api.memberships.getByUser) as
    | ({
        _id: Id<"ideas">;
        title: string;
        pitch: string;
        status: string;
        _creationTime: number;
        memberRoles?: string[];
      } | null)[]
    | undefined;
  const interestedIdeas = useQuery(api.interest.getByUser) as
    | ({
        _id: Id<"ideas">;
        title: string;
        pitch: string;
        status: string;
        _creationTime: number;
      } | null)[]
    | undefined;
  const unresolvedResources = useQuery(
    api.resourceRequests.getAllUnresolved,
  ) as UnresolvedResource[] | undefined;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">My Activity</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Track your ideas, teams, and requests
      </p>

      <Tabs defaultValue="created">
        <TabsList className="mb-4">
          <TabsTrigger value="created" className="gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />
            Created
          </TabsTrigger>
          <TabsTrigger value="joined" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Joined
          </TabsTrigger>
          <TabsTrigger value="interested" className="gap-1.5">
            <Heart className="h-3.5 w-3.5" />
            Interested
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="created">
          <IdeaList
            ideas={createdIdeas}
            emptyMessage="You haven't created any ideas yet."
            emptyAction={
              <Link
                href="/product/ideas/new"
                className="text-sm text-primary hover:underline"
              >
                Create your first idea
              </Link>
            }
          />
        </TabsContent>

        <TabsContent value="joined">
          <IdeaList
            ideas={joinedIdeas}
            emptyMessage="You haven't joined any teams yet."
            emptyAction={
              <Link
                href="/product"
                className="text-sm text-primary hover:underline"
              >
                Browse ideas to join
              </Link>
            }
          />
        </TabsContent>

        <TabsContent value="interested">
          <IdeaList
            ideas={interestedIdeas}
            emptyMessage="You haven't expressed interest in any ideas yet."
            emptyAction={
              <Link
                href="/product"
                className="text-sm text-primary hover:underline"
              >
                Browse ideas
              </Link>
            }
          />
        </TabsContent>

        <TabsContent value="resources">
          {unresolvedResources === undefined ? (
            <IdeaListSkeleton />
          ) : unresolvedResources.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4 animate-float">📦</div>
              <p className="text-muted-foreground mb-2">
                No unresolved resource requests across all ideas.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {unresolvedResources.map((req, i) => (
                <Link key={req._id} href={`/product/ideas/${req.ideaId}`}>
                  <Card
                    className={`hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 animate-fade-in stagger-${Math.min(i + 1, 9)}`}
                  >
                    <CardContent className="px-5 py-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <Badge variant="outline" className="shrink-0">
                          {req.resourceName}
                        </Badge>
                        <div className="min-w-0 space-y-1">
                          <div>
                            <p className="text-sm font-medium">{req.ideaTitle}</p>
                            <p className="text-xs text-muted-foreground">
                              by {req.ownerName}
                            </p>
                          </div>
                          {req.notes && (
                            <p className="text-sm text-muted-foreground break-words">
                              {req.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IdeaList({
  ideas,
  emptyMessage,
  emptyAction,
}: {
  ideas:
    | ({
        _id: Id<"ideas">;
        title: string;
        pitch: string;
        status: string;
        _creationTime: number;
      } | null)[]
    | undefined;
  emptyMessage: string;
  emptyAction?: React.ReactNode;
}) {
  if (ideas === undefined) {
    return <IdeaListSkeleton />;
  }

  if (ideas.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4 animate-float">🤷</div>
        <p className="text-muted-foreground mb-2">{emptyMessage}</p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ideas.map((idea, i) =>
        idea ? (
          <Link key={idea._id} href={`/product/ideas/${idea._id}`}>
            <Card
              className={`hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 animate-fade-in stagger-${Math.min(i + 1, 9)}`}
            >
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="secondary"
                    className={
                      STATUS_COLORS[idea.status as Status] || "bg-muted"
                    }
                  >
                    {STATUS_LABELS[idea.status as Status] || idea.status}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{idea.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {idea.pitch}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : null,
      )}
    </div>
  );
}
