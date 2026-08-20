import { NextResponse } from "next/server";
import { taskRepository, resultRepository } from "@/lib/db";

export async function GET() {
  try {
    const tasks = taskRepository.findAll();
    
    // Enrich tasks with results if available
    const enrichedTasks = tasks.map((task) => {
      const result = resultRepository.findByTaskId(task.id);
      return {
        id: String(task.id),
        filename: task.filename,
        status: task.status,
        error: task.error_message || undefined,
        results: result?.variants || undefined,
        batchId: task.batch_id,
        createdAt: task.created_at,
      };
    });

    return NextResponse.json(enrichedTasks);
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
