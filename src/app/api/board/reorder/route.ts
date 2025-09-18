import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { collections } from "@/lib/db";
import type { BoardStatus } from "@/lib/types";

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId || "").trim();
  const status = String(body?.status || "").trim();
  const orderedIds: string[] = Array.isArray(body?.orderedIds) ? body.orderedIds : [];
  if (!projectId || !status || !orderedIds.length) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  const { projects, boards } = await collections();
  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const bulk = boards.initializeUnorderedBulkOp();
  orderedIds.forEach((id, idx) => {
    bulk.find({ _id: id, projectId, status }).update({ $set: { order: idx, updatedAt: new Date().toISOString() } });
  });
  try { await bulk.execute(); } catch { /* ignore */ }
  const items = await boards.find({ projectId, status: status as BoardStatus }).sort({ order: 1 }).toArray();
  return NextResponse.json(items);
}
