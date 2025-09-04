import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { sprints, projects, stories } = await collections();
  const sprint = await sprints.findOne({ _id: params.id });
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: sprint.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const items = await stories.find({ sprintId: params.id }).toArray();
  return NextResponse.json({ sprint, stories: items });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { sprints, projects } = await collections();
  const sprint = await sprints.findOne({ _id: params.id });
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: sprint.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const status = body?.status as "active" | "completed" | "planned" | undefined;
  const updates: any = {};
  if (status) {
    updates.status = status;
    if (status === "completed") updates.completedAt = new Date().toISOString();
  }
  await sprints.updateOne({ _id: params.id }, { $set: updates });
  const updated = await sprints.findOne({ _id: params.id });
  return NextResponse.json(updated);
}
