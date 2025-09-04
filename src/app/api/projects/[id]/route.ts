import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { projects } = await collections();
  const proj = await projects.findOne({ _id: params.id, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(proj);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const { name } = body || {};
  const { projects } = await collections();
  // only owner can update
  const proj = await projects.findOne({ _id: params.id, ownerId: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await projects.updateOne({ _id: params.id }, { $set: { name: String(name || proj.name) } });
  const updated = await projects.findOne({ _id: params.id });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { projects, sprints, stories } = await collections();
  const proj = await projects.findOne({ _id: params.id, ownerId: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await stories.deleteMany({ projectId: params.id });
  await sprints.deleteMany({ projectId: params.id });
  await projects.deleteOne({ _id: params.id });
  return NextResponse.json({ ok: true });
}
