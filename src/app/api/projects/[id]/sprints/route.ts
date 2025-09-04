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
