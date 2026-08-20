import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    const db = getDatabase();
    
    const result = db
      .prepare("DELETE FROM tasks WHERE batch_id = ?")
      .run(batchId);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount: result.changes 
    });
  } catch (error) {
    console.error("Failed to delete batch:", error);
    return NextResponse.json({ error: "Failed to delete batch" }, { status: 500 });
  }
}
