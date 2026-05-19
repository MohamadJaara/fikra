"use client";

import { Badge } from "@/components/ui/badge";
import type { IdeaDetail } from "@/lib/types";

export function IdeaContent({ idea }: { idea: IdeaDetail }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-1">
          Problem
        </h3>
        <p className="text-sm whitespace-pre-wrap">{idea.problem}</p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-1">
          Target Audience
        </h3>
        <p className="text-sm whitespace-pre-wrap">{idea.targetAudience}</p>
      </div>
      {idea.skillsNeeded.length > 0 && (
        <div className="md:col-span-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Skills Needed
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {/* eslint-disable @eslint-react/no-array-index-key */}
            {idea.skillsNeeded.map((skill, i) => (
              <Badge key={i} variant="secondary">
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
