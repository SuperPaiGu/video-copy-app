"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResultVariantProps {
  variant: {
    title: string;
    copy: string;
    hashtags: string[];
  };
  index: number;
}

export function ResultVariant({ variant, index }: ResultVariantProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const handleCopy = async () => {
    const textToCopy = `${variant.title}\n\n${variant.copy}\n\n${variant.hashtags.join(" ")}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <div
      data-testid="result-variant"
      className="group relative overflow-hidden rounded-lg border border-muted-foreground/20 bg-card p-4 transition-all duration-300 hover:border-violet-500/50 hover:shadow-md"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-pink-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="relative space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground">
            候选 {index + 1}
          </span>
          <Button
            data-testid="copy-button"
            size="sm"
            variant={copyStatus === "copied" ? "default" : "outline"}
            onClick={handleCopy}
            className={cn(
              "transition-all duration-300",
              copyStatus === "copied" && "bg-green-600 hover:bg-green-700"
            )}
          >
            {copyStatus === "copied" ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                已复制
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                复制
              </>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          <div>
            <span className="text-xs font-semibold text-muted-foreground">标题</span>
            <p className="mt-1 text-sm font-medium">{variant.title}</p>
          </div>

          <div>
            <span className="text-xs font-semibold text-muted-foreground">文案</span>
            <p className="mt-1 text-sm leading-relaxed">{variant.copy}</p>
          </div>

          <div>
            <span className="text-xs font-semibold text-muted-foreground">标签</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {variant.hashtags.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
