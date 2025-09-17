import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";
import type { Story } from "@/lib/types";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const sprintId = params.id;
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const description = String(body?.description || "").trim() || undefined;
  const assignees = Array.isArray(body?.assignees) ? body.assignees : [];
  const priority = (body?.priority || "medium") as Story["priority"];
  const points = body?.points != null ? Number(body.points) : undefined;
  const tags = Array.isArray(body?.tags) ? body.tags : [];

  const { sprints, projects, stories } = await collections();

  let projectId: string | null = null;
  if (sprintId === "backlog") {
    projectId = String(body?.projectId || "").trim();
  } else {
    const sprint = await sprints.findOne({ _id: sprintId });
    if (!sprint) return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
    projectId = sprint.projectId;
  }
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date().toISOString();
  const story: Story = {
    _id: crypto.randomUUID(),
    projectId,
    sprintId: sprintId === "backlog" ? undefined as any : sprintId,
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
