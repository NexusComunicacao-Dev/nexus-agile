import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const body = await req.json().catch(() => ({}));

  const { stories, sprints, projects } = await collections();
  const story = await stories.findOne({ _id: params.id });
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (story.projectId) {
    const proj = await projects.findOne({ _id: story.projectId, memberIds: userId! });
    if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: any = {};
  if (body.title) updates.title = String(body.title);
  if (body.description !== undefined) updates.description = String(body.description || "");
  if (body.assignees) updates.assignees = Array.isArray(body.assignees) ? body.assignees : [];
  if (body.priority) updates.priority = body.priority;
  if (body.points !== undefined) updates.points = body.points != null ? Number(body.points) : undefined;
  if (body.tags) updates.tags = Array.isArray(body.tags) ? body.tags : [];
  if (body.sprintId !== undefined) {
    // Move para outro sprint ou backlog (sprintId = null / undefined / "backlog")
    const targetSprintId = body.sprintId;
    if (!targetSprintId || targetSprintId === "backlog") {
      updates.sprintId = undefined;
    } else {
      const targetSprint = await sprints.findOne({ _id: targetSprintId });
      if (!targetSprint) return NextResponse.json({ error: "Target sprint not found" }, { status: 404 });
      updates.sprintId = targetSprintId;
    }
  }
  if (body.status) {
    const nextStatus = String(body.status);
    const hist = (story.history || []).slice();
    const last = hist[hist.length - 1];
    if (!last || last.status !== nextStatus) hist.push({ status: nextStatus, at: new Date().toISOString() });
    updates.status = nextStatus;
    updates.history = hist;
  }

  await stories.updateOne({ _id: params.id }, { $set: updates });
  const updated = await stories.findOne({ _id: params.id });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const { stories, sprints, projects } = await collections();
  const story = await stories.findOne({ _id: params.id });
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sprint = await sprints.findOne({ _id: story.sprintId });
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: sprint.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await stories.deleteOne({ _id: params.id });
  return NextResponse.json({ ok: true });
}
