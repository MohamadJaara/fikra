"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  useProductViewer,
  useSelectedHackathon,
} from "@/components/ProductLayoutClient";
import { useState } from "react";
import { useRolesList } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PARTICIPATION_MODES,
  PARTICIPATION_MODE_LABELS,
  PARTICIPATION_MODE_COLORS,
  type ParticipationMode,
} from "@/lib/constants";
import { toast, Toaster } from "sonner";
import { MapPin, Wifi, Shield, Radio } from "lucide-react";
import { motion } from "framer-motion";

const section = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function SettingsPage() {
  const viewer = useProductViewer();
  const hackathon = useSelectedHackathon();
  const updateProfile = useMutation(api.users.updateProfile);
  const roles = useRolesList();

  const [form, setForm] = useState({
    firstName: viewer.firstName ?? "",
    lastName: viewer.lastName ?? "",
    selectedRoles: viewer.roles ?? [],
    participationMode: viewer.participationMode as
      | ParticipationMode
      | undefined,
  });
  const [prevViewer, setPrevViewer] = useState(viewer);
  if (viewer !== prevViewer) {
    setPrevViewer(viewer);
    setForm({
      firstName: viewer.firstName ?? "",
      lastName: viewer.lastName ?? "",
      selectedRoles: viewer.roles ?? [],
      participationMode: viewer.participationMode as
        | ParticipationMode
        | undefined,
    });
  }

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  const markDirty = () => setDirty(true);

  const toggleRole = (role: string) => {
    markDirty();
    setForm((prev) => ({
      ...prev,
      selectedRoles: prev.selectedRoles.includes(role)
        ? prev.selectedRoles.filter((r) => r !== role)
        : [...prev.selectedRoles, role],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateProfile({
        hackathonId: hackathon?._id,
        firstName: form.firstName,
        lastName: form.lastName,
        roles: form.selectedRoles,
        participationMode: form.participationMode,
      });
      setDirty(false);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials =
    (form.firstName?.[0] ?? "").toUpperCase() +
    (form.lastName?.[0] ?? "").toUpperCase();

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-6 md:py-16">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your profile and preferences.
          </p>
        </motion.header>

        <form onSubmit={handleSubmit} className="space-y-0">
          <div className="divide-y divide-border">
            <motion.section
              variants={section}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex gap-6 py-10 first:pt-0"
            >
              <div className="hidden sm:flex pt-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  {initials || "?"}
                </div>
              </div>

              <div className="flex-1 space-y-5">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    Personal Information
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Your name is visible to other participants.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="firstName"
                      className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      First Name *
                    </label>
                    <Input
                      id="firstName"
                      value={form.firstName}
                      onChange={(e) => {
                        markDirty();
                        setForm((prev) => ({
                          ...prev,
                          firstName: e.target.value,
                        }));
                      }}
                      placeholder="First name"
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lastName"
                      className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      Last Name
                    </label>
                    <Input
                      id="lastName"
                      value={form.lastName}
                      onChange={(e) => {
                        markDirty();
                        setForm((prev) => ({
                          ...prev,
                          lastName: e.target.value,
                        }));
                      }}
                      placeholder="Last name"
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Email
                  </label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    <span className="font-mono text-xs truncate">
                      {viewer.email ?? ""}
                    </span>
                    <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Locked
                    </span>
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              variants={section}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex gap-6 py-10"
            >
              <div className="hidden sm:flex pt-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    Roles
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Pick what fits — or explore. PM as an iOS dev? Go for it.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => {
                    const active = form.selectedRoles.includes(role.slug);
                    return (
                      <button
                        type="button"
                        key={role.slug}
                        onClick={() => toggleRole(role.slug)}
                        className={cn(
                          "inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
                          "border",
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-muted/50",
                        )}
                      >
                        {role.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.section>

            <motion.section
              variants={section}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.19, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex gap-6 py-10"
            >
              <div className="hidden sm:flex pt-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Radio className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    Participation Mode
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    On-site or remote — helps teams match with you.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {PARTICIPATION_MODES.map((mode) => {
                    const active = form.participationMode === mode;
                    return (
                      <button
                        type="button"
                        key={mode}
                        onClick={() => {
                          markDirty();
                          setForm((prev) => ({
                            ...prev,
                            participationMode:
                              prev.participationMode === mode ? undefined : mode,
                          }));
                        }}
                        className={cn(
                          "inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
                          "border",
                          active
                            ? PARTICIPATION_MODE_COLORS[mode]
                            : "border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-muted/50",
                        )}
                      >
                        {mode === "onsite" ? (
                          <MapPin className="mr-1.5 h-3.5 w-3.5" />
                        ) : (
                          <Wifi className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {PARTICIPATION_MODE_LABELS[mode]}
                      </button>
                    );
                  })}
                  {!form.participationMode && (
                    <span className="inline-flex items-center rounded-full border border-dashed border-border px-3.5 py-1.5 text-sm text-muted-foreground">
                      Not decided yet
                    </span>
                  )}
                </div>
              </div>
            </motion.section>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28, duration: 0.4 }}
            className="pt-8 pb-12"
          >
            <Button
              type="submit"
              size="lg"
              disabled={
                isSubmitting || form.firstName.trim().length === 0 || !dirty
              }
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving…
                </span>
              ) : (
                "Save Changes"
              )}
            </Button>
          </motion.div>
        </form>
      </div>

      <Toaster position="bottom-right" />
    </div>
  );
}
