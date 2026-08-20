"use client";

import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  onUpload: (files: File[]) => void;
  uploading: boolean;
}

export function FileUploadZone({ onUpload, uploading }: FileUploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
    multiple: true,
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300",
        isDragActive
          ? "border-violet-500 bg-violet-500/10 scale-[1.02]"
          : "border-muted-foreground/25 hover:border-violet-500/50 hover:bg-accent/50",
        uploading && "opacity-50 cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} id="video-upload" />
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-full bg-violet-500/20 blur-xl" />
          <div className="relative rounded-full bg-gradient-to-br from-violet-500 to-pink-500 p-4">
            {isDragActive ? (
              <Video className="h-8 w-8 text-white animate-bounce" />
            ) : (
              <Upload className="h-8 w-8 text-white" />
            )}
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">
            {isDragActive ? "松开以上传视频" : "拖拽视频到此处"}
          </p>
          <p className="text-sm text-muted-foreground">
            或点击选择文件 · 支持多个视频同时上传
          </p>
          <div className="flex flex-col gap-1 mt-2">
            <p className="text-xs text-violet-400/80">
              💡 最多可同时处理 8 个视频
            </p>
            <p className="text-xs text-muted-foreground/70">
              📦 单个视频最大 1GB
            </p>
          </div>
        </div>

        <Button
          type="button"
          disabled={uploading}
          className="gradient-violet-pink hover:opacity-90 transition-opacity"
        >
          {uploading ? "上传中..." : "选择视频"}
        </Button>
      </div>
    </div>
  );
}
