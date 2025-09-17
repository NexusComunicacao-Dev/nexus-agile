import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

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
  const body = await req.json().catch(() => ({}));
  const session = await getServerSession(authOptions);
  const isAdmin = Boolean((session?.user as any)?.admin);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { sprints, projects } = await collections();
  const sprint = await sprints.findOne({ _id: params.id });
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: sprint.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updates: any = {};
  if (body.status === "completed") {
    updates.status = "completed";
    updates.completedAt = new Date().toISOString();
  }
  if (body.name) updates.name = String(body.name).trim();
  if (body.goal !== undefined) updates.goal = String(body.goal || "").trim() || undefined;
  if (Object.keys(updates).length === 0) return NextResponse.json(sprint);

  await sprints.updateOne({ _id: sprint._id }, { $set: updates });
  const updated = await sprints.findOne({ _id: sprint._id });
  return NextResponse.json(updated);
}
