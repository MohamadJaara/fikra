"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ROLE_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import type { Role, Status } from "@/lib/constants";
import type { UserProfile } from "@/lib/types";
import { use, useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Lightbulb, Users } from "lucide-react";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const profile = useQuery(api.users.getProfile, { handle });
  const viewer = useQuery(api.users.viewer);

  const isOwnProfile = profile && viewer && profile._id === viewer._id;

  if (profile === undefined || viewer === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="text-center py-12">
          <p className="text-lg font-medium mb-2">User not found</p>
          <Link
            href="/product/people"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            Back to People
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href="/product/people"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        People
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <Avatar className="h-16 w-16 shrink-0">
          <AvatarImage src={profile.image} />
          <AvatarFallback className="text-xl">
            {(profile.name || profile.firstName || "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{profile.name || "Unknown"}</h1>
          {profile.handle && (
            <p className="text-sm text-muted-foreground">@{profile.handle}</p>
          )}
          {isOwnProfile && (
            <Link
              href="/product/settings"
              className="text-xs text-primary hover:underline"
            >
              Edit profile
            </Link>
          )}
        </div>
      </div>

      {profile.roles && profile.roles.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {profile.roles.map((r) => (
              <Badge key={r} variant="secondary">
                {ROLE_LABELS[r as Role] || r}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator className="my-6" />

      {profile.ownedIdeas.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Lightbulb className="h-5 w-5" />
            Ideas ({profile.ownedIdeas.length})
          </h2>
          <div className="space-y-2">
            {profile.ownedIdeas.map((idea) => (
              <Link
                key={idea._id}
                href={`/product/ideas/${idea._id}`}
                className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{idea.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {idea.pitch}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      STATUS_COLORS[idea.status as Status] || "bg-muted"
                    }
                  >
                    {STATUS_LABELS[idea.status as Status] || idea.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {profile.joinedIdeas.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Users className="h-5 w-5" />
            Teams ({profile.joinedIdeas.length})
          </h2>
          <div className="space-y-2">
            {profile.joinedIdeas.map((idea) => (
              <Link
                key={idea._id}
                href={`/product/ideas/${idea._id}`}
                className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{idea.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {idea.pitch}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {idea.memberRole && (
                      <Badge variant="outline" className="text-[10px]">
                        {ROLE_LABELS[idea.memberRole as Role] ||
                          idea.memberRole}
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className={
                        STATUS_COLORS[idea.status as Status] || "bg-muted"
                      }
                    >
                      {STATUS_LABELS[idea.status as Status] || idea.status}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {profile.ownedIdeas.length === 0 && profile.joinedIdeas.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No ideas or teams yet.
        </p>
      )}
    </div>
  );
}
