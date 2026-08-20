"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from "lucide-react";

interface HistoryTaskCardProps {
  task: {
    id: string;
    filename: string;
    status: "done" | "failed";
    error?: string;
    results?: Array<{
      title: string;
      copy: string;
      hashtags: string[];
    }>;
  };
}

export function HistoryTaskCard({ task }: HistoryTaskCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-4">
      {/* Header: clickable to toggle expand/collapse */}
      <div 
        className="flex items-center justify-between cursor-pointer hover:bg-accent/50 transition-colors rounded -m-4 p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          
          <span className="font-medium text-foreground truncate">
            {task.filename}
          </span>
        </div>

        {task.status === "done" ? (
          <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
        ) : (
          <XCircle className="h-5 w-5 text-destructive shrink-0" />
        )}
      </div>

      {/* Expanded state: show copy results (text selectable) */}
      {expanded && (
        <div className="mt-4 space-y-4 pl-7 select-text">
          {task.status === "failed" && task.error ? (
            <div className="text-sm text-destructive">
              错误: {task.error}
            </div>
          ) : task.results && task.results.length > 0 ? (
            task.results.map((result, index) => (
              <div key={index} className="space-y-2 pb-4 border-b border-border last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-violet-400 border-violet-400/50">
                    文案 {index + 1}
                  </Badge>
                  <span className="text-sm font-medium text-foreground">
                    {result.title}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {result.copy}
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.hashtags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded-full bg-violet-500/10 text-violet-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">
              暂无文案结果
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
