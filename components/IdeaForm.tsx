"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STATUSES,
  STATUS_LABELS,
  TEAM_SIZES,
  TEAM_SIZE_LABELS,
  type TeamSize,
} from "@/lib/constants";
import { useResourcesList, useRolesList } from "@/lib/hooks";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, MapPin } from "lucide-react";
import { Fragment, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSelectedHackathon } from "@/components/ProductLayoutClient";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export type IdeaFormData = {
  hackathonId?: Id<"hackathons">;
  title: string;
  pitch: string;
  problem: string;
  targetAudience: string;
  skillsNeeded: string[];
  teamSize: TeamSize;
  status: string;
  lookingForRoles: string[];
  resourceTags?: string[];
  resourceNotes?: string;
  categoryId?: string;
  onsiteOnly?: boolean;
};

type IdeaFormProps = {
  initialData?: Partial<IdeaFormData>;
  onSubmit: (data: IdeaFormData) => Promise<void>;
  isEditing?: boolean;
  isSubmitting?: boolean;
  initialCategoryId?: string;
};

export function IdeaForm({
  initialData,
  onSubmit,
  isEditing,
  isSubmitting,
  initialCategoryId,
}: IdeaFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [pitch, setPitch] = useState(initialData?.pitch || "");
  const [problem, setProblem] = useState(initialData?.problem || "");
  const [targetAudience, setTargetAudience] = useState(
    initialData?.targetAudience || "",
  );
  const [skillsText, setSkillsText] = useState(
    initialData?.skillsNeeded?.join(", ") || "",
  );
  const [teamSize, setTeamSize] = useState<TeamSize>(
    initialData?.teamSize ?? "small",
  );
  const [status, setStatus] = useState(initialData?.status || "exploring");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    initialData?.lookingForRoles || [],
  );
  const [selectedResourceTags, setSelectedResourceTags] = useState<string[]>(
    initialData?.resourceTags || [],
  );
  const [resourceNotes, setResourceNotes] = useState(
    initialData?.resourceNotes || "",
  );
  const [categoryId, setCategoryId] = useState(
    initialData?.categoryId || initialCategoryId || "",
  );
  const [onsiteOnly, setOnsiteOnly] = useState(
    initialData?.onsiteOnly || false,
  );
  const [step, setStep] = useState(0);
  const [maxVisitedStep, setMaxVisitedStep] = useState(0);
  const [stepOneAttempted, setStepOneAttempted] = useState(false);

  const hackathon = useSelectedHackathon();
  const categories = useQuery(api.categories.list, {
    hackathonId: hackathon?._id,
  });
  const roles = useRolesList();
  const resources = useResourcesList();
  const statusOptions = isEditing
    ? STATUSES
    : STATUSES.filter((s) => s !== "shelved");

  const steps = [
    { title: "The Idea", subtitle: "What are you building and who is it for?" },
    {
      title: "The Team",
      subtitle: "Who you need on board and how you'll work",
    },
    ...(isEditing
      ? []
      : [
          {
            title: "Extras",
            subtitle: "Anything your team needs to hit the ground running",
          },
        ]),
  ];
  const isFinalStep = step === steps.length - 1;

  const stepOneValid =
    title.trim().length > 0 &&
    pitch.trim().length > 0 &&
    problem.trim().length > 0 &&
    targetAudience.trim().length > 0 &&
    (!isEditing ? Boolean(categoryId) : true);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const toggleResourceTag = (tag: string) => {
    setSelectedResourceTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const goToStep = (index: number) => {
    if (index < 0 || index >= steps.length || index > maxVisitedStep) return;
    setStep(index);
    setMaxVisitedStep((prev) => Math.max(prev, index));
  };

  const goNext = () => {
    if (step === 0 && !stepOneValid) {
      setStepOneAttempted(true);
      return;
    }
    setStepOneAttempted(false);
    goToStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFinalStep) {
      goNext();
      return;
    }
    const skillsNeeded = skillsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await onSubmit({
      hackathonId: hackathon?._id,
      title,
      pitch,
      problem,
      targetAudience,
      skillsNeeded,
      teamSize,
      status,
      lookingForRoles: selectedRoles,
      resourceTags: isEditing ? undefined : selectedResourceTags,
      resourceNotes: isEditing ? undefined : resourceNotes || undefined,
      categoryId: categoryId || undefined,
      onsiteOnly,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <ol className="flex items-center">
        {steps.map((s, i) => {
          const completed = i < step;
          const active = i === step;
          const reachable = i <= maxVisitedStep;
          return (
            <Fragment key={s.title}>
              <li>
                <button
                  type="button"
                  onClick={() => reachable && goToStep(i)}
                  disabled={!reachable}
                  className="flex items-center gap-2 disabled:cursor-default"
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                      (active || completed) &&
                        "border-foreground bg-foreground text-background",
                      !active &&
                        !completed &&
                        "border-border text-muted-foreground/60",
                    )}
                  >
                    {completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.title}
                  </span>
                </button>
              </li>
              {i < steps.length - 1 && (
                <li aria-hidden className="h-px flex-1 bg-border mx-3" />
              )}
            </Fragment>
          );
        })}
      </ol>

      <div key={step} className="mt-8 animate-fade-in space-y-5">
        <div>
          <p className="text-sm font-semibold">{steps[step].title}</p>
          <p className="text-sm text-muted-foreground">
            {steps[step].subtitle}
          </p>
        </div>

        {step === 0 && (
          <>
            <div>
              <label
                htmlFor="title"
                className="text-sm font-medium mb-1.5 block"
              >
                Title
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your idea a short, memorable name"
                maxLength={120}
                className="text-base"
              />
              <p className="text-xs text-muted-foreground/60 mt-1 tabular-nums">
                {title.length}/120
              </p>
            </div>

            <div>
              <label
                htmlFor="pitch"
                className="text-sm font-medium mb-1.5 block"
              >
                One-line Pitch
              </label>
              <Input
                id="pitch"
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                placeholder="What's the elevator pitch?"
                maxLength={200}
                className="text-base"
              />
              <p className="text-xs text-muted-foreground/60 mt-1 tabular-nums">
                {pitch.length}/200
              </p>
            </div>

            <div>
              <label
                htmlFor="problem"
                className="text-sm font-medium mb-1.5 block"
              >
                Problem it Solves
              </label>
              <Textarea
                id="problem"
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="What pain point or opportunity are you addressing?"
                maxLength={1000}
                rows={4}
                className="text-sm leading-relaxed resize-none"
              />
            </div>

            <div>
              <label
                htmlFor="audience"
                className="text-sm font-medium mb-1.5 block"
              >
                Who it&apos;s For
              </label>
              <Textarea
                id="audience"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Who would use this? Who benefits?"
                maxLength={500}
                rows={3}
                className="text-sm leading-relaxed resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Category{" "}
                {!isEditing && <span className="text-destructive">*</span>}
              </label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {isEditing && (
                    <SelectItem value="none">No category</SelectItem>
                  )}
                  {categories?.map((cat) => (
                    <SelectItem key={cat._id} value={cat._id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <label
                htmlFor="skills"
                className="text-sm font-medium mb-1.5 block"
              >
                Skills Needed
              </label>
              <Input
                id="skills"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="e.g. React, Python, ML, iOS (comma-separated)"
              />
              <p className="text-xs text-muted-foreground/60 mt-1">
                Comma-separated list of skills
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="teamSize"
                  className="text-sm font-medium mb-1.5 block"
                >
                  Team Size
                </label>
                <Select
                  value={teamSize}
                  onValueChange={(value) => setTeamSize(value as TeamSize)}
                >
                  <SelectTrigger id="teamSize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_SIZES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {TEAM_SIZE_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground/60 mt-1.5 italic">
                  3–5 is usually the sweet spot
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Status
                </label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Looking For
              </label>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <Badge
                    key={role.slug}
                    variant={
                      selectedRoles.includes(role.slug) ? "default" : "outline"
                    }
                    className="cursor-pointer select-none"
                    onClick={() => toggleRole(role.slug)}
                  >
                    {role.name}
                  </Badge>
                ))}
                {roles.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No roles configured yet.
                  </p>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2.5 py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={onsiteOnly}
                onChange={(e) => setOnsiteOnly(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-sm font-medium">On-site only</span>
                <span className="block text-xs text-muted-foreground/70">
                  Only on-site participants can join this team
                </span>
              </div>
            </label>
          </>
        )}

        {!isEditing && step === 2 && (
          <div className="space-y-4">
            {resources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No resource options configured yet. An admin can add them from
                the dashboard.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Select any resources your team will need
                </p>
                <div className="flex flex-wrap gap-2">
                  {resources.map((resource) => (
                    <Badge
                      key={resource.slug}
                      variant={
                        selectedResourceTags.includes(resource.slug)
                          ? "default"
                          : "outline"
                      }
                      className="cursor-pointer select-none"
                      onClick={() => toggleResourceTag(resource.slug)}
                    >
                      {resource.name}
                    </Badge>
                  ))}
                </div>
              </>
            )}

            {selectedResourceTags.length > 0 && (
              <div>
                <label
                  htmlFor="resourceNotes"
                  className="text-sm font-medium mb-1.5 block"
                >
                  Resource Notes
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    (optional)
                  </span>
                </label>
                <Input
                  id="resourceNotes"
                  value={resourceNotes}
                  onChange={(e) => setResourceNotes(e.target.value)}
                  placeholder="Any details about what you need?"
                  maxLength={500}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-10 pt-2 flex items-start justify-between gap-4">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => goToStep(step - 1)}
          >
            Back
          </Button>
        ) : (
          <span aria-hidden />
        )}

        <div className="flex flex-col items-end gap-1.5">
          {isFinalStep ? (
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || !stepOneValid}
              className="min-w-[160px]"
            >
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {isEditing ? "Save Changes" : "Create Idea"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={goNext}
              disabled={step === 0 && !stepOneValid}
            >
              Next
            </Button>
          )}
          {step === 0 && !stepOneValid && stepOneAttempted && (
            <p className="text-xs text-muted-foreground">
              Fill in the required fields to continue
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
