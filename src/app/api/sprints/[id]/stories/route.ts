import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";
import type { Story } from "@/lib/types";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  const description = String(body?.description || "").trim() || undefined;
  const assignees = Array.isArray(body?.assignees) ? body.assignees : [];
  const priority = (body?.priority || "medium") as Story["priority"];
  const points = body?.points != null ? Number(body.points) : undefined;
  const tags = Array.isArray(body?.tags) ? body.tags : [];

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const { sprints, projects, stories } = await collections();
  const sprint = await sprints.findOne({ _id: params.id });
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: sprint.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date().toISOString();
  const story: Story = {
    _id: crypto.randomUUID(),
    projectId: sprint.projectId,
    sprintId: sprint._id,
    title,
    description,
    assignees,
    priority,
    points,
    tags,
    status: "todo",
    createdAt: now,
    history: [{ status: "todo", at: now }],
  };

  await stories.insertOne(story as any);
  return NextResponse.json(story, { status: 201 });
}
