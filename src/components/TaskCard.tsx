"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { ResultVariant } from "./ResultVariant";
import { VariantPlaceholder } from "./VariantPlaceholder";

interface Task {
  id: string;
  filename: string;
  status: "queued" | "processing" | "done" | "failed";
  error?: string;
  results?: Array<{
    title: string;
    copy: string;
    hashtags: string[];
  }>;
}

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const getStatusConfig = () => {
    switch (task.status) {
      case "queued":
        return {
          icon: <Clock className="h-4 w-4" />,
          label: "排队中",
          variant: "secondary" as const,
          progress: 0,
        };
      case "processing":
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          label: "处理中",
          variant: "default" as const,
          progress: 50,
        };
      case "done":
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          label: "已完成",
          variant: "default" as const,
          progress: 100,
        };
      case "failed":
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          label: "失败",
          variant: "destructive" as const,
          progress: 0,
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <Card
      data-testid="task-card"
      className="overflow-hidden border-muted-foreground/20 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/10"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-lg font-semibold truncate flex-1">
            {task.filename}
          </CardTitle>
          <Badge
            variant={statusConfig.variant}
            className="flex items-center gap-1.5 shrink-0"
          >
            {statusConfig.icon}
            <span data-testid="task-status">{statusConfig.label}</span>
          </Badge>
        </div>
        {task.status !== "failed" && (
          <Progress
            value={statusConfig.progress}
            className="h-1.5 mt-3"
          />
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {task.error && (
          <div
            data-testid="task-error"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{task.error}</span>
          </div>
        )}

        <div data-testid="task-results" className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">
            生成结果 (3组候选)
          </h4>
          <div className="grid gap-3">
            {task.status === "done" && (!task.results || task.results.length === 0) ? (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>生成结果为空,请重试。</span>
              </div>
            ) : task.results && task.results.length > 0 ? (
              task.results.map((variant, index) => (
                <ResultVariant key={index} variant={variant} index={index} />
              ))
            ) : (
              <>
                <VariantPlaceholder index={0} />
                <VariantPlaceholder index={1} />
                <VariantPlaceholder index={2} />
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
