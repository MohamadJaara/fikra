"use client";

import { useState } from "react";
import { useConvex } from "convex/react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { buildIdeasReportMarkdown } from "./reports";

export function IdeasReportButton({
  hackathonId,
}: {
  hackathonId?: Id<"hackathons">;
}) {
  const convex = useConvex();
  const hackathonArgs = hackathonId ? { hackathonId } : {};
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const report = await convex.query(api.admin.ideasReport, hackathonArgs);
      const markdown = buildIdeasReportMarkdown(report);
      const blob = new Blob([markdown], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date(report.generatedAt).toISOString().slice(0, 10);
      link.href = url;
      link.download = `fikra-ideas-report-${date}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Ideas report generated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate report",
      );
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 gap-1.5"
      onClick={() => void handleGenerateReport()}
      disabled={isGeneratingReport}
    >
      {isGeneratingReport ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Generate report
    </Button>
  );
}
