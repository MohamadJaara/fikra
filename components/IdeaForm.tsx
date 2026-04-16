"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/lib/constants";
import { useResourcesList, useRolesList } from "@/lib/hooks";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export type IdeaFormData = {
  title: string;
  pitch: string;
  problem: string;
  targetAudience: string;
  skillsNeeded: string[];
  teamSizeWanted: number;
  status: string;
  lookingForRoles: string[];
  resourceTags?: string[];
  resourceNotes?: string;
  categoryId?: string;
};

type IdeaFormProps = {
  initialData?: Partial<IdeaFormData>;
  onSubmit: (data: IdeaFormData) => Promise<void>;
  isEditing?: boolean;
  isSubmitting?: boolean;
};

export function IdeaForm({
  initialData,
  onSubmit,
  isEditing,
  isSubmitting,
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
  const [teamSizeWanted, setTeamSizeWanted] = useState(
    initialData?.teamSizeWanted || 4,
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
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "");
  const categories = useQuery(api.categories.list);
  const roles = useRolesList();
  const resources = useResourcesList();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const skillsNeeded = skillsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await onSubmit({
      title,
      pitch,
      problem,
      targetAudience,
      skillsNeeded,
      teamSizeWanted,
      status,
      lookingForRoles: selectedRoles,
      resourceTags: isEditing ? undefined : selectedResourceTags,
      resourceNotes: isEditing ? undefined : resourceNotes || undefined,
      categoryId: categoryId || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give your idea a short, memorable name"
          required
          maxLength={120}
        />
        <p className="text-xs text-muted-foreground">{title.length}/120</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pitch">One-line Pitch</Label>
        <Input
          id="pitch"
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          placeholder="What's the elevator pitch?"
          required
          maxLength={200}
        />
        <p className="text-xs text-muted-foreground">{pitch.length}/200</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="problem">Problem it Solves</Label>
        <Textarea
          id="problem"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="What pain point or opportunity are you addressing?"
          required
          maxLength={1000}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="audience">Who it&apos;s For</Label>
        <Textarea
          id="audience"
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          placeholder="Who would use this? Who benefits?"
          required
          maxLength={500}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="skills">Skills Needed</Label>
        <Input
          id="skills"
          value={skillsText}
          onChange={(e) => setSkillsText(e.target.value)}
          placeholder="e.g. React, Python, ML, iOS (comma-separated)"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated list of skills
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="teamSize">Team Size Wanted</Label>
          <Input
            id="teamSize"
            type="number"
            min={1}
            max={20}
            value={teamSizeWanted}
            onChange={(e) => setTeamSizeWanted(parseInt(e.target.value) || 1)}
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>
          Category {!isEditing && <span className="text-destructive">*</span>}
        </Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {isEditing && <SelectItem value="none">No category</SelectItem>}
            {categories?.map((cat) => (
              <SelectItem key={cat._id} value={cat._id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Looking for Roles</Label>
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
        </div>
      </div>

      {!isEditing && (
        <>
          <div className="space-y-2">
            <Label>Resource Requests</Label>
            <p className="text-xs text-muted-foreground">
              Select any resources your team will need
            </p>
            {resources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No resource options are configured yet. An admin can add them
                from the admin dashboard.
              </p>
            ) : (
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
            )}
          </div>

          {selectedResourceTags.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="resourceNotes">Resource Notes (optional)</Label>
              <Input
                id="resourceNotes"
                value={resourceNotes}
                onChange={(e) => setResourceNotes(e.target.value)}
                placeholder="Any details about what you need?"
                maxLength={500}
              />
            </div>
          )}
        </>
      )}

      <Button
        type="submit"
        disabled={isSubmitting || (!isEditing && !categoryId)}
      >
        {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {isEditing ? "Save Changes" : "Create Idea"}
      </Button>
    </form>
  );
}
