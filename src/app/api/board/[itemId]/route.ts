import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { collections } from "@/lib/db";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ itemId: string }> } // UPDATED
) {
  const { itemId } = await context.params; // NEW
  const { userId, error } = await requireUser();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const { sprints: board, projects, stories } = await collections();
  const item = await board.findOne({ _id: itemId }); // UPDATED
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: item.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updates: any = { updatedAt: new Date().toISOString() };
  let statusChanged = false;
  if (body.title) updates.title = String(body.title).trim();
  if (body.description !== undefined) updates.description = String(body.description || "");
  if (body.status && body.status !== item.status) {
    const count = await board.countDocuments({ projectId: item.projectId, status: body.status });
    updates.status = body.status;
    updates.order = count;
    statusChanged = true;
  }
  if (body.detachStory === true) {
    updates.storyId = undefined;
  } else if (body.storyId) {
    const story = await stories.findOne({ _id: body.storyId, projectId: item.projectId });
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    updates.storyId = body.storyId;
  }
  await board.updateOne({ _id: item._id }, { $set: updates });
  const updated = await board.findOne({ _id: item._id });

  // sincronizar status story
  if (updated?.storyId && statusChanged && ["todo","doing","done"].includes(updated.status)) {
    await stories.updateOne({ _id: updated.storyId }, { $set: { status: updated.status } });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await context.params;
  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  try {
    const { userId, error } = await requireUser();
    if (error) return error;
    const { sprints: board, projects } = await collections();
    const item = await board.findOne({ _id: itemId });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const proj = await projects.findOne({ _id: item.projectId, memberIds: userId! });
    if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await board.deleteOne({ _id: item._id });
    return NextResponse.json({ ok: true, id: itemId });
  } catch (e) {
    console.error("DELETE /api/board/[itemId] failed", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
