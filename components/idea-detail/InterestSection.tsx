"use client";

import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Heart, Loader2, MapPin, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar, UserLink } from "@/components/UserLink";
import { useRolesMap } from "@/lib/hooks";
import { toast } from "sonner";
import type { IdeaDetail } from "@/lib/types";

export function InterestSection({
  idea,
  ideaId,
}: {
  idea: IdeaDetail;
  ideaId: Id<"ideas">;
}) {
  const expressMutation = useMutation(api.interest.express);
  const removeMutation = useMutation(api.interest.remove);
  const roleLabels = useRolesMap();
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      if (idea.isInterested) {
        await removeMutation({ ideaId });
        toast.success("Interest removed");
      } else {
        await expressMutation({ ideaId });
        toast.success("Interest expressed!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setIsToggling(false);
    }
  };

  const sortedUsers = useMemo(() => {
    const needed = new Set(idea.lookingForRoles);
    return [...idea.interestedUsers].sort((a, b) => {
      const aHas = (a.roles ?? []).some((r) => needed.has(r));
      const bHas = (b.roles ?? []).some((r) => needed.has(r));
      if (aHas !== bHas) return aHas ? -1 : 1;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [idea.interestedUsers, idea.lookingForRoles]);

  const neededRoles = useMemo(
    () => new Set(idea.lookingForRoles),
    [idea.lookingForRoles],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground">
          Interested ({idea.interestCount})
        </p>
        <Button
          variant={idea.isInterested ? "default" : "outline"}
          size="sm"
          onClick={handleToggle}
          disabled={isToggling}
          className={
            idea.isInterested
              ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-500"
              : "hover:border-rose-300 hover:text-rose-600 dark:hover:border-rose-700 dark:hover:text-rose-400"
          }
        >
          {isToggling ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Heart
              className={`h-3.5 w-3.5 mr-1.5 ${idea.isInterested ? "fill-current" : ""}`}
            />
          )}
          {idea.isInterested ? "Interested" : "I'm Interested"}
        </Button>
      </div>

      {sortedUsers.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {sortedUsers.map((user) => (
            <div key={user._id} className="flex items-center gap-1.5">
              <UserAvatar
                handle={user.handle}
                image={user.image}
                name={user.name}
              />
              <UserLink
                handle={user.handle}
                name={user.name}
                className="text-sm"
              />
              {[...(user.roles ?? [])]
                .filter((r) => neededRoles.has(r))
                .map((r) => (
                  <Badge
                    key={r}
                    variant="secondary"
                    className="text-[9px] px-1 py-0 font-medium text-emerald-700 border border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-950"
                  >
                    {roleLabels[r] || r}
                  </Badge>
                ))}
              {user.participationMode === "onsite" ? (
                <MapPin className="h-3 w-3 text-blue-500 shrink-0" />
              ) : user.participationMode === "remote" ? (
                <Wifi className="h-3 w-3 text-purple-500 shrink-0" />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
