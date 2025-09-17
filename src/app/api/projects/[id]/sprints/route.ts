import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";
import type { Sprint } from "@/lib/types";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const goal = String(body?.goal || "").trim() || undefined;
  const startDate = body?.startDate || new Date().toISOString();
  const endDate = body?.endDate || undefined;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { projects, sprints } = await collections();
  const proj = await projects.findOne({ _id: params.id, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sprint: Sprint = {
    _id: crypto.randomUUID(),
    projectId: params.id,
    name,
    goal,
    startDate,
    endDate,
    status: "active",
    createdBy: userId!,
    createdAt: new Date().toISOString(),
  };

  await sprints.insertOne(sprint as any);
  return NextResponse.json(sprint, { status: 201 });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const projectId = params.id;
  const { sprints, projects, stories } = await collections();

  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const searchParams = new URL(req.url).searchParams;
  const wantActive = searchParams.get("active");

  const activeSprint = await sprints.findOne({ projectId, status: "active" });
  const activeStories = activeSprint
    ? await stories.find({ projectId, sprintId: activeSprint._id }).sort({ createdAt: -1 }).toArray()
    : [];
  const backlog = await stories
    .find({ projectId, $or: [{ sprintId: null }, { sprintId: { $exists: false } }] })
    .sort({ createdAt: -1 })
    .toArray();
  const history = wantActive === "1" || wantActive === "true" ? await sprints
    .find({ projectId, status: "completed" })
    .sort({ completedAt: -1 })
    .limit(25)
    .toArray() : [];

  return NextResponse.json({ activeSprint, activeStories, backlog, history });
}
