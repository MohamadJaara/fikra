"use client";

import { Badge } from "@/components/ui/badge";
import type { IdeaDetail } from "@/lib/types";

export function IdeaContent({ idea }: { idea: IdeaDetail }) {
  return (
    <div className="mb-10">
      <div className="grid md:grid-cols-2 gap-x-10 gap-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mb-2">
            Problem
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {idea.problem}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mb-2">
            Target Audience
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {idea.targetAudience}
          </p>
        </div>
      </div>
      {idea.skillsNeeded.length > 0 && (
        <div className="mt-6">
          <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mb-2.5">
            Skills Needed
          </p>
          <div className="flex flex-wrap gap-1.5">
            {/* eslint-disable @eslint-react/no-array-index-key */}
            {idea.skillsNeeded.map((skill, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-[11px] font-medium"
              >
                {skill}
              </Badge>
            ))}
            {/* eslint-enable @eslint-react/no-array-index-key */}
          </div>
        </div>
      )}
    </div>
  );
}
