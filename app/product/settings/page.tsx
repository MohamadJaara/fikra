"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProductViewer } from "@/components/ProductLayoutClient";
import { useState, useEffect } from "react";
import { useRolesList } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PARTICIPATION_MODES,
  PARTICIPATION_MODE_LABELS,
  PARTICIPATION_MODE_COLORS,
  type ParticipationMode,
} from "@/lib/constants";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Save, MapPin, Wifi } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const viewer = useProductViewer();
  const updateProfile = useMutation(api.users.updateProfile);
  const roles = useRolesList();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [participationMode, setParticipationMode] = useState<
    ParticipationMode | undefined
  >(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (viewer && !loaded) {
      setFirstName(viewer.firstName ?? "");
      setLastName(viewer.lastName ?? "");
      if (viewer.roles) {
        setSelectedRoles(viewer.roles);
      }
      setParticipationMode(
        viewer.participationMode as ParticipationMode | undefined,
      );
      setLoaded(true);
    }
  }, [viewer, loaded]);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateProfile({
        firstName,
        lastName,
        roles: selectedRoles,
        participationMode,
      });
      toast.success("Profile updated!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <Link
        href="/product"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Browse
      </Link>

      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-0">
        <div className="py-6">
          <h2 className="text-base font-semibold mb-1">Personal Information</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Update your name and email details.
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={viewer.email ?? ""}
                disabled
                className="mt-1.5 bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed.
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="py-6">
          <h2 className="text-base font-semibold mb-1">Roles</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You can pick more than one! This doesn&apos;t have to match your
            day-to-day role at work — feel free to explore. Want to try PM, or
            build backend as an iOS dev? Go for it.
          </p>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <Badge
                key={role.slug}
                variant={
                  selectedRoles.includes(role.slug) ? "default" : "outline"
                }
                className="cursor-pointer select-none text-sm px-3 py-1.5"
                onClick={() => toggleRole(role.slug)}
              >
                {role.name}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <div className="py-6">
          <h2 className="text-base font-semibold mb-1">Participation Mode</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Are you joining the hackathon on-site or remotely? This is shown
            on your profile and helps team owners match participants.
          </p>
          <div className="flex flex-wrap gap-2">
            {PARTICIPATION_MODES.map((mode) => (
              <Badge
                key={mode}
                variant={participationMode === mode ? "default" : "outline"}
                className={cn(
                  "cursor-pointer select-none text-sm px-3 py-1.5",
                  participationMode === mode &&
                    PARTICIPATION_MODE_COLORS[mode],
                )}
                onClick={() =>
                  setParticipationMode((prev) =>
                    prev === mode ? undefined : mode,
                  )
                }
              >
                {mode === "onsite" ? (
                  <MapPin className="h-3 w-3 mr-1.5" />
                ) : (
                  <Wifi className="h-3 w-3 mr-1.5" />
                )}
                {PARTICIPATION_MODE_LABELS[mode]}
              </Badge>
            ))}
            {!participationMode && (
              <Badge
                variant="secondary"
                className="text-sm px-3 py-1.5 text-muted-foreground"
              >
                Not decided yet
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        <div className="py-6">
          <Button
            type="submit"
            disabled={isSubmitting || firstName.trim().length === 0}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>

      <Toaster />
    </div>
  );
}
