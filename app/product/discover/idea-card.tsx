"use client";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Flame, Users, MapPin, ArrowRight, ArrowLeft } from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS, TEAM_SIZE_LABELS } from "@/lib/constants";
import type { TeamSize } from "@/lib/constants";
import { useCallback, useState } from "react";

export type DiscoverIdeaCardData = {
  _id: string;
  _creationTime: number;
  title: string;
  pitch: string;
  problem: string;
  targetAudience: string;
  skillsNeeded: string[];
  teamSize: TeamSize;
  status: string;
  lookingForRoles: string[];
  ownerId: string;
  categoryName?: string;
  ownerName: string;
  ownerImage?: string;
  ownerHandle?: string;
  memberCount: number;
  interestCount: number;
  reactionCounts: Record<string, number>;
  missingRoles: string[];
  hasUnresolvedResources: boolean;
  isMember: boolean;
  isInterested: boolean;
  isOwner: boolean;
  onsiteOnly?: boolean;
  trendingScore: number;
  roleMatchCount: number;
};

type IdeaCardProps = {
  idea: DiscoverIdeaCardData;
  onSwipe: (direction: "left" | "right") => void;
  onTap: () => void;
  isTop: boolean;
  userRoles?: string[];
};

const SWIPE_THRESHOLD = 120;

export function DiscoverIdeaCard({
  idea,
  onSwipe,
  onTap,
  isTop,
  userRoles,
}: IdeaCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0.5, 1, 1, 1, 0.5]);

  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  const [dragging, setDragging] = useState(false);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      setDragging(false);
      const offset = info.offset.x;
      const velocity = info.velocity.x;

      if (offset > SWIPE_THRESHOLD || velocity > 500) {
        onSwipe("right");
      } else if (offset < -SWIPE_THRESHOLD || velocity < -500) {
        onSwipe("left");
      }
    },
    [onSwipe],
  );

  const isTrending = idea.trendingScore > 10;

  const matchedRoles =
    userRoles?.filter((role) => idea.missingRoles.includes(role)) ?? [];

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, rotate, opacity, touchAction: "pan-y" }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      dragListener={isTop}
      onDragStart={() => setDragging(true)}
      onDragEnd={handleDragEnd}
      onClick={() => {
        if (!dragging) onTap();
      }}
      initial={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 10 }}
      animate={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 10 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="h-full rounded-2xl border bg-card shadow-lg overflow-hidden flex flex-col">
        <motion.div
          className="absolute top-4 left-4 z-10 rounded-xl bg-green-500/90 px-4 py-2 text-white font-bold text-lg flex items-center gap-2 shadow-lg"
          style={{ opacity: likeOpacity }}
        >
          <ArrowRight className="h-5 w-5" />
          Interested
        </motion.div>

        <motion.div
          className="absolute top-4 right-4 z-10 rounded-xl bg-red-500/90 px-4 py-2 text-white font-bold text-lg flex items-center gap-2 shadow-lg"
          style={{ opacity: nopeOpacity }}
        >
          Skip
          <ArrowLeft className="h-5 w-5" />
        </motion.div>

        <div className="flex-1 p-6 overflow-auto overscroll-contain" style={{ touchAction: "pan-y" }}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold leading-tight mb-1">
                {idea.title}
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={idea.ownerImage} />
                  <AvatarFallback className="text-[10px]">
                    {idea.ownerName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{idea.ownerName}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isTrending && (
                <Badge
                  variant="secondary"
                  className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 gap-1"
                >
                  <Flame className="h-3 w-3" />
                  Trending
                </Badge>
              )}
              <Badge className={STATUS_COLORS[idea.status as keyof typeof STATUS_COLORS] ?? ""}>
                {STATUS_LABELS[idea.status as keyof typeof STATUS_LABELS] ?? idea.status}
              </Badge>
            </div>
          </div>

          {idea.categoryName && (
            <Badge variant="outline" className="mb-3">
              {idea.categoryName}
            </Badge>
          )}

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            {idea.pitch}
          </p>

          {idea.problem && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                Problem
              </h3>
              <p className="text-sm line-clamp-3">{idea.problem}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {idea.memberCount} member{idea.memberCount !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1">
                <ArrowRight className="h-4 w-4" />
                {idea.interestCount} interested
              </span>
              <span>Team: {TEAM_SIZE_LABELS[idea.teamSize]}</span>
              {idea.onsiteOnly && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  On-site
                </span>
              )}
            </div>

            {idea.missingRoles.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
                  Looking for
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {idea.missingRoles.map((role) => {
                    const isMatch = matchedRoles.includes(role);
                    return (
                      <Badge
                        key={role}
                        variant={isMatch ? "default" : "outline"}
                        className={
                          isMatch
                            ? "bg-green-600 text-white"
                            : ""
                        }
                      >
                        {isMatch && "You match! "}
                        {role}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {idea.skillsNeeded.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
                  Skills
                </h3>
                <div className="flex flex-wrap gap-1">
                  {idea.skillsNeeded.slice(0, 5).map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {idea.skillsNeeded.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{idea.skillsNeeded.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t px-6 py-3 bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {idea.roleMatchCount > 0
              ? `${idea.roleMatchCount} role${idea.roleMatchCount > 1 ? "s" : ""} matched`
              : "Swipe right to show interest"}
          </span>
          <span className="flex items-center gap-1">
            Swipe or use buttons below
          </span>
        </div>
      </div>
    </motion.div>
  );
}
