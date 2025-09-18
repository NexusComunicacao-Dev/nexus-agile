import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { collections } from "@/lib/db";

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  const projectId = String(body?.projectId || "").trim();
  const description =
    typeof body?.description === "string" && body.description.trim()
      ? body.description.trim()
      : undefined;
  const assigneeId = body?.assigneeId ? String(body.assigneeId) : null;
  if (!title || !projectId) {
    return NextResponse.json({ error: "title and projectId are required" }, { status: 400 });
  }
  const { projects, stories } = await collections();
  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date().toISOString();
  const doc = {
    _id: crypto.randomUUID(),
    projectId,
    sprintId: null,
    title,
    description,
    status: "todo",
    assigneeId: assigneeId || null,
    createdAt: now,
    history: [{ status: "todo", at: now }],
  };
  await stories.insertOne(doc as any);
  return NextResponse.json(doc, { status: 201 });
}
