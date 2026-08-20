"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface VariantPlaceholderProps {
  index: number;
}

export function VariantPlaceholder({ index }: VariantPlaceholderProps) {
  return (
    <div
      data-testid="result-variant"
      className="relative overflow-hidden rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground">
            候选 {index + 1}
          </p>
          <p className="text-xs text-muted-foreground/70">等待生成...</p>
        </div>
      </div>
    </div>
  );
}
