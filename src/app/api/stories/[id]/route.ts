import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";

async function resolveParams(p: any): Promise<{ id: string }> {
  return typeof p?.then === "function" ? await p : p;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id } = await context.params;
  const { stories, projects } = await collections();
  const story = await stories.findOne({ _id: id });
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: story.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(story);
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  const { stories, projects } = await collections();
  const story = await stories.findOne({ _id: id });
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const proj = await projects.findOne({ _id: story.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const update: any = {};
  const historyPush: any[] = [];
  const now = new Date().toISOString();
  const allowedStatuses = ["todo","doing","testing","awaiting deploy","deployed","done"];

  if (body.status && allowedStatuses.includes(body.status)) {
    // Adiciona ao histórico se o status mudou
    if (story.status !== body.status) {
      // Se não há histórico e a história está saindo de "todo", adiciona evento retroativo
      if ((!story.history || story.history.length === 0) && story.status === "todo") {
        const retroactiveDate = story.createdAt || now;
        historyPush.push({ status: "todo", at: retroactiveDate });
      }
      historyPush.push({ status: body.status, at: now });
    }
    update.status = body.status;
  }
  if (body.points != null) {
    const n = Number(body.points);
    if (!Number.isNaN(n)) update.points = n;
  }
  if (typeof body.description === "string") {
    update.description = body.description.trim() || undefined;
  }
  if (body.sprintId === null) {
    // Remove da sprint - adiciona evento especial ao histórico
    if (story.sprintId !== null) {
      historyPush.push({ event: "removed-from-sprint", at: now });
    }
    update.sprintId = null;
  } else if (typeof body.sprintId === "string" && body.sprintId.trim()) {
    // Adiciona à sprint - adiciona evento especial ao histórico
    if (story.sprintId !== body.sprintId.trim()) {
      historyPush.push({
        event: "added-to-sprint",
        sprintId: body.sprintId.trim(),
        status: story.status || "todo",
        at: now
      });
    }
    update.sprintId = body.sprintId.trim();
  }
  if ("assigneeId" in body) {
    if (body.assigneeId === null || body.assigneeId === "") {
      update.assigneeId = null;
    } else if (typeof body.assigneeId === "string") {
      update.assigneeId = body.assigneeId;
    }
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  // Atualiza o documento com $set e $push para histórico
  const updateOps: any = { $set: update };
  if (historyPush.length > 0) {
    updateOps.$push = { history: { $each: historyPush } };
  }

  await stories.updateOne({ _id: id }, updateOps);
  const next = await stories.findOne({ _id: id });
  return NextResponse.json(next);
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id } = await context.params;
  const { stories, projects } = await collections();
  const story = await stories.findOne({ _id: id });
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: story.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await stories.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}