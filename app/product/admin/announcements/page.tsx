"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Megaphone,
  Plus,
  Trash2,
  AlertTriangle,
  PartyPopper,
  ToggleLeft,
  ToggleRight,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { useSelectedHackathon } from "@/components/ProductLayoutClient";
import { AnimatePresence, motion } from "framer-motion";

const TYPE_META: Record<
  string,
  {
    label: string;
    icon: typeof Megaphone;
    color: string;
    previewGradient: string;
  }
> = {
  info: {
    label: "Info",
    icon: Megaphone,
    color:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
    previewGradient:
      "from-indigo-600 via-blue-600 to-violet-600 dark:from-indigo-500 dark:via-blue-500 dark:to-violet-500",
  },
  urgent: {
    label: "Urgent",
    icon: AlertTriangle,
    color: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
    previewGradient:
      "from-rose-600 via-red-600 to-orange-600 dark:from-rose-500 dark:via-red-500 dark:to-orange-500",
  },
  celebration: {
    label: "Celebration",
    icon: PartyPopper,
    color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    previewGradient:
      "from-amber-500 via-yellow-500 to-emerald-500 dark:from-amber-400 dark:via-yellow-400 dark:to-emerald-400",
  },
};

export default function AdminAnnouncementsPage() {
  const hackathon = useSelectedHackathon();
  const announcements = useQuery(api.announcements.list, {
    hackathonId: hackathon?._id,
  });
  const createAnnouncement = useMutation(api.announcements.create);
  const removeAnnouncement = useMutation(api.announcements.remove);
  const updateAnnouncement = useMutation(api.announcements.update);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const ANNOUNCEMENT_TYPE_KEYS = Object.keys(TYPE_META) as Array<
    "info" | "urgent" | "celebration"
  >;

  const [type, setType] = useState<"info" | "urgent" | "celebration">("info");

  const handleCreate = async () => {
    try {
      await createAnnouncement({
        hackathonId: hackathon?._id,
        title,
        message,
        type,
      });
      toast.success("Announcement created");
      setTitle("");
      setMessage("");
      setType("info");
      setCreateOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    }
  };

  const handleToggleActive = async (
    id: Id<"announcements">,
    active: boolean,
  ) => {
    try {
      await updateAnnouncement({ announcementId: id, active: !active });
      toast.success(
        !active ? "Announcement activated" : "Announcement deactivated",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
  };

  const handleDelete = async (id: Id<"announcements">, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await removeAnnouncement({ announcementId: id });
      toast.success("Announcement deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/product/admin"
            className="text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="h-6 w-6" />
              Announcements
            </h1>
            <p className="text-sm text-muted-foreground">
              Broadcast messages to all users
            </p>
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <div className="flex flex-wrap gap-2">
                  {ANNOUNCEMENT_TYPE_KEYS.map((t) => {
                    const meta = TYPE_META[t];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                          type === t
                            ? "border-primary bg-primary/5"
                            : "border-transparent bg-muted/50 hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="e.g. Judging starts in 30 minutes!"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  placeholder="Provide more details..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>

              {title && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Preview
                  </p>
                  <div
                    className={`overflow-hidden rounded-lg bg-gradient-to-r ${TYPE_META[type].previewGradient} px-4 py-2.5`}
                  >
                    <div className="min-w-0 space-y-1 sm:flex sm:items-start sm:gap-2 sm:space-y-0">
                      <p className="min-w-0 break-words text-sm font-semibold text-white sm:max-w-[45%]">
                        {title}
                      </p>
                      {message && (
                        <div className="min-w-0 sm:flex sm:flex-1 sm:items-start sm:gap-2">
                          <span className="hidden text-white/50 sm:inline">
                            ·
                          </span>
                          <p className="min-w-0 break-words text-sm text-white/85">
                            {message}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleCreate}
                disabled={!title.trim() || !message.trim()}
                className="w-full"
              >
                Publish Announcement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {announcements === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading announcements...</div>
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Megaphone className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">No announcements yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create your first announcement to broadcast a message to all users.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {announcements.map((announcement, i) => {
              const meta = TYPE_META[announcement.type] ?? TYPE_META.info;
              const Icon = meta.icon;
              return (
                <motion.div
                  key={announcement._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: i * 0.05 }}
                  className={`relative rounded-xl border overflow-hidden transition-opacity ${
                    announcement.active ? "opacity-100" : "opacity-60"
                  }`}
                >
                  {!announcement.active && (
                    <div className="absolute inset-0 bg-background/40 z-10 flex items-center justify-center">
                      <Badge variant="secondary" className="text-xs">
                        Inactive
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-start gap-4 p-4">
                    <div className={`shrink-0 p-2.5 rounded-lg ${meta.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">
                          {announcement.title}
                        </h3>
                        <Badge variant="outline" className={meta.color}>
                          {meta.label}
                        </Badge>
                        {announcement.active && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {announcement.message}
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                        <span>
                          by {announcement.creatorName} ·{" "}
                          {new Date(
                            announcement._creationTime,
                          ).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {announcement.dismissedCount} dismissed
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleToggleActive(
                            announcement._id,
                            announcement.active,
                          )
                        }
                        title={announcement.active ? "Deactivate" : "Activate"}
                      >
                        {announcement.active ? (
                          <ToggleRight className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleDelete(announcement._id, announcement.title)
                        }
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <Toaster />
    </div>
  );
}
