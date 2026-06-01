"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IdeaListSkeleton } from "@/components/Skeleton";
import {
  STATUS_DOT_COLORS,
  STATUS_LABELS,
  STATUS_BORDER_COLORS,
  type Status,
} from "@/lib/constants";
import type { UnresolvedResource } from "@/lib/types";
import { Lightbulb, Users, Heart, Package, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

type TabKey = "created" | "joined" | "interested" | "resources";

const TABS: { key: TabKey; label: string; icon: typeof Lightbulb }[] = [
  { key: "created", label: "Created", icon: Lightbulb },
  { key: "joined", label: "Joined", icon: Users },
  { key: "interested", label: "Interested", icon: Heart },
  { key: "resources", label: "Resources", icon: Package },
];

const statusAccentColors: Record<Status, string> = {
  exploring: "text-blue-500",
  forming_team: "text-amber-500",
  full: "text-zinc-400 dark:text-zinc-500",
  building: "text-emerald-500",
  shelved: "text-stone-500",
};

export default function ActivityPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("created");

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

  const counts: Record<TabKey, number> = {
    created: createdIdeas?.length ?? 0,
    joined: joinedIdeas?.filter(Boolean).length ?? 0,
    interested: interestedIdeas?.filter(Boolean).length ?? 0,
    resources: unresolvedResources?.length ?? 0,
  };

  const isLoading =
    createdIdeas === undefined ||
    joinedIdeas === undefined ||
    interestedIdeas === undefined ||
    unresolvedResources === undefined;

  return (
    <div className="min-h-[calc(100vh-120px)]">
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8 pb-16">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10"
        >
          <h1 className="text-3xl font-bold tracking-tight">My Activity</h1>
          <p className="text-sm text-muted-foreground mt-1.5 tracking-wide">
            Track your ideas, teams, and resource requests
          </p>
          <div className="mt-5 h-px w-full animate-line-grow" />
        </motion.header>

        <motion.nav
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: 0.15,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative mb-8"
        >
          <div className="flex gap-6 border-b border-border/60">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors duration-200 cursor-pointer ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground/70"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                  <span>{tab.label}</span>
                  {!isLoading && counts[tab.key] > 0 && (
                    <span
                      className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded-full transition-colors duration-200 ${
                        isActive
                          ? "bg-foreground/10 text-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {counts[tab.key]}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activity-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground rounded-full"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.nav>

        <AnimatePresence mode="wait">
          <motion.section
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === "resources" ? (
              <ResourceList resources={unresolvedResources} />
            ) : activeTab === "created" ? (
              <IdeaList
                ideas={createdIdeas}
                emptyMessage="No ideas created yet"
                emptyDescription="Start by sharing a concept that excites you."
                emptyAction={
                  <Link
                    href="/product/ideas/new"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/70 transition-colors group"
                  >
                    Create your first idea
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                }
              />
            ) : activeTab === "joined" ? (
              <IdeaList
                ideas={joinedIdeas}
                emptyMessage="No teams joined yet"
                emptyDescription="Discover ideas and join teams that match your skills."
                emptyAction={
                  <Link
                    href="/product"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/70 transition-colors group"
                  >
                    Browse ideas
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                }
              />
            ) : (
              <IdeaList
                ideas={interestedIdeas}
                emptyMessage="No interest expressed yet"
                emptyDescription="Explore ideas and indicate which ones catch your eye."
                emptyAction={
                  <Link
                    href="/product"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/70 transition-colors group"
                  >
                    Discover ideas
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                }
              />
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  );
}

function IdeaList({
  ideas,
  emptyMessage,
  emptyDescription,
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
  emptyDescription: string;
  emptyAction?: React.ReactNode;
}) {
  if (ideas === undefined) {
    return <IdeaListSkeleton />;
  }

  const filtered = ideas.filter(Boolean);
  if (filtered.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center text-center">
        <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-foreground/80">{emptyMessage}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
          {emptyDescription}
        </p>
        {emptyAction && <div className="mt-5">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {filtered.map((idea, i) => {
        if (!idea) return null;
        const status = idea.status as Status;
        const dotColor = STATUS_DOT_COLORS[status] || "bg-zinc-400";
        const borderColor = STATUS_BORDER_COLORS[status] || "border-l-zinc-300";
        const accentColor = statusAccentColors[status] || "text-zinc-400";
        return (
          <motion.div
            key={idea._id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.3,
              delay: i * 0.04,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <Link
              href={`/product/ideas/${idea._id}`}
              className={`group flex items-start gap-4 py-4 pl-4 border-l-2 ${borderColor} hover:bg-muted/30 transition-colors duration-150`}
            >
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2.5 mb-1">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}
                  />
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-widest ${accentColor}`}
                  >
                    {STATUS_LABELS[status] || idea.status}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-foreground/80 transition-colors truncate">
                  {idea.title}
                </h3>
                {idea.pitch && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 leading-relaxed">
                    {idea.pitch}
                  </p>
                )}
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 mt-1 shrink-0" />
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

function ResourceList({
  resources,
}: {
  resources: UnresolvedResource[] | undefined;
}) {
  if (resources === undefined) {
    return <IdeaListSkeleton />;
  }

  if (resources.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center text-center">
        <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center mb-4">
          <Package className="h-4 w-4 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-foreground/80">All clear</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
          No unresolved resource requests across any ideas.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {resources.map((req, i) => (
        <motion.div
          key={req._id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.3,
            delay: i * 0.04,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <Link
            href={`/product/ideas/${req.ideaId}`}
            className="group flex items-start gap-4 py-4 pl-4 border-l-2 border-l-orange-400 dark:border-l-orange-500 hover:bg-muted/30 transition-colors duration-150"
          >
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2.5 mb-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-orange-500" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400">
                  {req.resourceName}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-foreground/80 transition-colors truncate">
                {req.ideaTitle}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                requested by{" "}
                <span className="font-medium text-foreground/60">
                  {req.ownerName}
                </span>
              </p>
              {req.notes && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1 leading-relaxed">
                  {req.notes}
                </p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 mt-1 shrink-0" />
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
