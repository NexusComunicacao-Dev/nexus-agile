import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { collections } from "@/lib/db";

async function resolveParams(p: any): Promise<{ id: string }> {
  return typeof p?.then === "function" ? await p : p;
}

export async function POST(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id } = await resolveParams((ctx as any).params);
  const body = await req.json().catch(() => ({}));
  const text = String(body?.text || "").trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const { stories, projects } = await collections();
  const story = await stories.findOne({ _id: id });
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: story.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const comment = {
    _id: crypto.randomUUID(),
    userId: userId!,
    text,
    createdAt: new Date().toISOString(),
  };
  await stories.updateOne({ _id: id }, { $push: { comments: comment } });
  const updated = await stories.findOne({ _id: id });
  return NextResponse.json({ ok: true, comment, comments: updated?.comments || [] });
}
