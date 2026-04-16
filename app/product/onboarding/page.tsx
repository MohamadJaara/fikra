"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useRolesList } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from "sonner";
import { Lightbulb, ArrowRight } from "lucide-react";

function parseNameFromEmail(email: string): {
  firstName: string;
  lastName: string;
} {
  if (!email) return { firstName: "", lastName: "" };
  const localPart = email.split("@")[0] ?? "";
  if (!localPart) return { firstName: "", lastName: "" };
  const dotIndex = localPart.indexOf(".");
  if (dotIndex === -1) return { firstName: "", lastName: "" };
  const first = localPart.substring(0, dotIndex);
  const last = localPart.substring(dotIndex + 1);
  if (!first || !last) return { firstName: "", lastName: "" };
  return {
    firstName: first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(),
    lastName: last.charAt(0).toUpperCase() + last.slice(1).toLowerCase(),
  };
}

export default function OnboardingPage() {
  const viewer = useQuery(api.users.viewer);
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const roles = useRolesList();
  const router = useRouter();

  const parsed = useMemo(() => {
    if (!viewer?.email) return { firstName: "", lastName: "" };
    return parseNameFromEmail(viewer.email);
  }, [viewer?.email]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (viewer !== undefined && viewer !== null && !initialized) {
    if (!firstName && parsed.firstName) setFirstName(parsed.firstName);
    if (!lastName && parsed.lastName) setLastName(parsed.lastName);
    if (viewer.roles && viewer.roles.length > 0) {
      setSelectedRoles(viewer.roles);
    }
    setInitialized(true);
  }

  if (viewer === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Lightbulb className="h-8 w-8 text-yellow-500 animate-float" />
          <div className="animate-shimmer h-4 w-24 rounded" />
        </div>
      </div>
    );
  }

  if (viewer === null) return null;

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await completeOnboarding({
        firstName,
        lastName,
        roles: selectedRoles,
      });
      toast.success("Profile set up!");
      router.push("/product");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save profile",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">
            <Lightbulb className="h-8 w-8 text-yellow-500 animate-float" />
          </div>
          <CardTitle className="text-2xl">Welcome to Fikra!</CardTitle>
          <CardDescription>
            Set up your profile to get started with the hackathon idea board.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
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
              <Label>Your Role(s)</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                You can pick more than one! This doesn&apos;t have to match your
                day-to-day role at work — feel free to explore. Want to try PM,
                or build backend as an iOS dev? Go for it.
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

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || firstName.trim().length === 0}
            >
              {isSubmitting ? "Saving..." : "Get Started"}
              {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Toaster />
    </div>
  );
}
