"use client";

import React, { useState, useEffect } from "react";
import { FileUploadZone } from "@/components/FileUploadZone";
import { TaskCard } from "@/components/TaskCard";
import { HistoryTaskCard } from "@/components/HistoryTaskCard";
import { AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  batchId: string;
  createdAt: string;
}

export default function HomePage() {
  type TabType = "current" | "history";
  const [activeTab, setActiveTab] = useState<TabType>("current");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "task" | "batch";
    id: string;
    count?: number;
  }>({ open: false, type: "task", id: "" });

  // Fetch tasks on mount and set up polling
  useEffect(() => {
    fetchTasks();
    
    if (activeTab === "current") {
      const interval = setInterval(fetchTasks, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  async function fetchTasks() {
    try {
      const response = await fetch("/api/tasks");
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    }
  }

  // Get latest batch_id (sorted by createdAt)
  const latestBatchId = tasks.length > 0 
    ? tasks.reduce((latest, task) => {
        return new Date(task.createdAt) > new Date(latest.createdAt) ? task : latest;
      }).batchId
    : null;

  // Current tasks: all tasks from latest batch_id
  const currentTasks = latestBatchId 
    ? tasks.filter((task) => task.batchId === latestBatchId)
    : [];

  // History tasks: tasks from older batch_ids
  const historyTasks = latestBatchId
    ? tasks.filter((task) => task.batchId !== latestBatchId)
    : tasks;

  // Group tasks by batch
  interface BatchGroup {
    batchId: string;
    tasks: Task[];
    createdAt: string;
  }
  
  function groupTasksByBatch(tasks: Task[]): BatchGroup[] {
    const grouped = tasks.reduce((acc, task) => {
      if (!acc[task.batchId]) {
        acc[task.batchId] = [];
      }
      acc[task.batchId].push(task);
      return acc;
    }, {} as Record<string, Task[]>);
  
    return Object.entries(grouped)
      .map(([batchId, tasks]) => ({
        batchId,
        tasks: tasks.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
        createdAt: tasks[0].createdAt,
      }))
      .sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  // Format batch time
  function formatBatchTime(isoString: string): string {
    const date = new Date(isoString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  }

  // Handle delete
  async function handleDelete(type: "task" | "batch", id: string) {
    try {
      const endpoint = type === "task" 
        ? `/api/tasks/${id}` 
        : `/api/batches/${id}`;
      
      const response = await fetch(endpoint, { method: "DELETE" });
      
      if (response.ok) {
        await fetchTasks();
        setDeleteDialog({ open: false, type: "task", id: "" });
      } else {
        const error = await response.json();
        console.error("Delete failed:", error);
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  }

  async function handleUpload(files: File[]) {
    if (!files || files.length === 0) {
      setUploadMessage({ type: "error", text: "请选择文件" });
      return;
    }

    setUploading(true);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("videos", file);
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const uploadedTasks = await response.json();
        setUploadMessage({
          type: "success",
          text: `上传成功！已创建 ${uploadedTasks.length} 个任务`,
        });
        // Fetch tasks immediately to show new uploads
        await fetchTasks();
      } else {
        const error = await response.json();
        setUploadMessage({
          type: "error",
          text: error.error || "上传失败",
        });
      }
    } catch (error) {
      setUploadMessage({
        type: "error",
        text: "上传失败，请重试",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-violet-950/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-12 text-center space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
            视频文案生成
          </h1>
          <p className="text-muted-foreground text-lg">
            上传视频，自动生成三组抖音风格文案
          </p>
        </header>

        {/* Upload Section */}
        <section aria-label="upload-section" className="mb-8">
          <FileUploadZone onUpload={handleUpload} uploading={uploading} />

          {uploadMessage && (
            <div
              className={`mt-4 flex items-start gap-3 rounded-lg p-4 ${
                uploadMessage.type === "success"
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}
            >
              {uploadMessage.type === "error" && (
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              )}
              <span>{uploadMessage.text}</span>
            </div>
          )}
        </section>

        {/* Task List */}
        <section role="region" aria-label="task-list" className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-border">
            <div
              onClick={() => setActiveTab("current")}
              className={`px-6 py-3 font-medium transition-colors relative cursor-pointer ${
                activeTab === "current"
                  ? "text-violet-400 border-b-2 border-violet-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              当前任务
              {currentTasks.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-violet-500/20 text-violet-400">
                  {currentTasks.length}
                </span>
              )}
            </div>
            <div
              onClick={() => setActiveTab("history")}
              className={`px-6 py-3 font-medium transition-colors relative cursor-pointer ${
                activeTab === "history"
                  ? "text-violet-400 border-b-2 border-violet-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              历史记录
              {historyTasks.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-violet-500/20 text-violet-400">
                  {historyTasks.length}
                </span>
              )}
            </div>
          </div>

          {/* Task Content */}
          {activeTab === "current" ? (
            <div className="grid gap-6">
              {currentTasks.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-lg">暂无进行中的任务</p>
                </div>
              ) : (
                currentTasks.map((task) => <TaskCard key={task.id} task={task} />)
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {historyTasks.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-lg">暂无历史记录</p>
                </div>
              ) : (
                groupTasksByBatch(historyTasks).map((batch) => (
                  <div key={batch.batchId} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">
                        {batch.batchId === "legacy" 
                          ? "历史任务" 
                          : `批次: ${formatBatchTime(batch.createdAt)}上传`}
                        <span className="ml-3 text-sm text-muted-foreground font-normal">
                          ({batch.tasks.length}个任务)
                        </span>
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteDialog({
                          open: true,
                          type: "batch",
                          id: batch.batchId,
                          count: batch.tasks.length,
                        })}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除批次
                      </Button>
                    </div>
                    <div className="grid gap-4">
                      {batch.tasks.map((task) => (
                        <HistoryTaskCard key={task.id} task={task} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* Delete Confirmation Dialog */}
        <AlertDialog 
          open={deleteDialog.open} 
          onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteDialog.type === "batch" 
                  ? `将删除该批次的 ${deleteDialog.count} 个任务,此操作无法撤销。`
                  : "确定要删除这个任务吗?此操作无法撤销。"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDelete(deleteDialog.type, deleteDialog.id)}
                className="bg-destructive hover:bg-destructive/90"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
}
