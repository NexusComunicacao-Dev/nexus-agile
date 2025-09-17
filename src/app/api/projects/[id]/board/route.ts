import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { collections } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const projectId = params.id;
  const { projects, board, stories } = await collections();
  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const items = await board.find({ projectId }).sort({ status: 1, order: 1, createdAt: 1 }).toArray();
  const storyIds = items.filter(i => i.storyId).map(i => i.storyId);
  let storyMap = new Map<string, any>();
  if (storyIds.length) {
    const list = await stories.find({ _id: { $in: storyIds } }).project({ title: 1, points: 1, status: 1 }).toArray();
    storyMap = new Map(list.map((s: any) => [s._id, s]));
  }
  // NEW: sincronizar status do card com a story (story como fonte). Ignora cards backlog.
  const mismatches = items.filter(i => i.storyId && i.status !== 'backlog').filter(i => {
    const st = storyMap.get(i.storyId!); return st && st.status && st.status !== i.status; });
  if (mismatches.length) {
    const bulk = board.initializeUnorderedBulkOp();
    mismatches.forEach(m => {
      const st = storyMap.get(m.storyId!); if (!st) return;
      bulk.find({ _id: m._id }).update({ $set: { status: st.status, updatedAt: new Date().toISOString() } });
    });
    try { await bulk.execute(); } catch { /* ignore */ }
    // Atualiza em memória para resposta consistente
    mismatches.forEach(m => { const st = storyMap.get(m.storyId!); if (st) (m as any).status = st.status; });
  }
  const enriched = items.map(i => ({ ...i, _story: i.storyId ? storyMap.get(i.storyId) : null }));
  return NextResponse.json(enriched);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const projectId = params.id;
  const body = await req.json().catch(() => ({}));
  const titleRaw = String(body?.title || "").trim();
  const storyId = body?.storyId ? String(body.storyId) : null;
  if (!titleRaw && !storyId) return NextResponse.json({ error: "title or storyId required" }, { status: 400 });
  const status = (body?.status || "backlog").trim();
  const { projects, board, stories } = await collections();
  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let finalTitle = titleRaw;
  if (storyId) {
    const story = await stories.findOne({ _id: storyId, projectId });
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    const existingLink = await board.findOne({ projectId, storyId });
    if (existingLink) return NextResponse.json({ error: "Story already linked" }, { status: 409 });
    if (!finalTitle) finalTitle = story.title;
    // Se status for todo/doing/done, reflete na story
    if (["todo", "doing", "done"].includes(status)) {
      await stories.updateOne({ _id: storyId }, { $set: { status } });
    }
  }

  const count = await board.countDocuments({ projectId, status });
  const now = new Date().toISOString();
  const doc = { _id: crypto.randomUUID(), projectId, title: finalTitle, status, order: count, createdBy: userId!, createdAt: now, updatedAt: now, storyId: storyId || undefined };
  await board.insertOne(doc as any);
  return NextResponse.json(doc, { status: 201 });
}
