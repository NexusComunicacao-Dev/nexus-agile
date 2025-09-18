import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";

// NEW: helper para tratar params possivelmente assíncrono
async function resolveParams(p: any): Promise<{ id: string }> {
  return typeof p?.then === "function" ? await p : p;
}

// SUBSTITUI: DEFAULT_COLUMNS
const DEFAULT_COLUMNS = [
  { id: "todo", title: "To Do", items: [] },
  { id: "doing", title: "Doing", items: [] },
  { id: "testing", title: "Testing", items: [] },
  { id: "awaiting deploy", title: "Awaiting Deploy", items: [] },
  { id: "deployed", title: "Deployed", items: [] },
  { id: "done", title: "Done", items: [] },
];

// Helper para normalizar id/título de coluna em lowercase
function norm(v: string) {
  return v.trim().toLowerCase();
}

// Ordem / conjunto definitivo de colunas
const REQUIRED_ORDER = ["todo","doing","testing","awaiting deploy","deployed","done"];

export async function GET(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id: projectId } = await resolveParams((ctx as any).params);
  const { projects, boards, stories, sprints } = await collections();
  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let doc = await boards.findOne({ projectId });

  // NEW: cria doc/colunas padrão caso não exista ou esteja vazio
  if (!doc || !Array.isArray(doc.columns) || doc.columns.length === 0) {
    await boards.updateOne(
      { projectId },
      { $setOnInsert: { projectId }, $set: { columns: DEFAULT_COLUMNS } },
      { upsert: true }
    );
    doc = await boards.findOne({ projectId });
  }

  // MIGRAÇÃO / NORMALIZAÇÃO: remover 'backlog', garantir todas as novas colunas
  const existingCols = Array.isArray(doc?.columns) ? doc.columns : [];
  const mapped = new Map<string, any>();

  for (const c of existingCols) {
    const idRaw = c.id || c.status || c.title || "";
    const id = norm(idRaw);
    if (id === "backlog") continue; // descarta legado
    if (REQUIRED_ORDER.includes(id) && !mapped.has(id)) {
      mapped.set(id, { ...c, id, title: c.title || c.id || id, items: c.items || [] });
    }
  }

  // Constroi colunas finais na ordem fixa
  const finalColumns = REQUIRED_ORDER.map(id => {
    if (mapped.has(id)) return mapped.get(id);
    const def = DEFAULT_COLUMNS.find(dc => norm(dc.id) === id) || { id, title: id.replace(/\b\w/g, m => m.toUpperCase()), items: [] };
    return def;
  });

  // Persiste se mudou
  const changed =
    JSON.stringify(existingCols.map((c: any) => norm(c.id || c.title || c.status || ""))) !==
    JSON.stringify(finalColumns.map(c => c.id));

  if (changed) {
    await boards.updateOne({ projectId }, { $set: { columns: finalColumns } });
    doc = await boards.findOne({ projectId });
    doc!.columns = finalColumns; // garante retorno atualizado
  } else {
    doc!.columns = finalColumns; // garante ordem normalizada mesmo sem alteração real
  }

  // Sprint ativa + histórias
  const activeSprint = await sprints.findOne({ projectId, status: "active" });
  let sprintStories: any[] = [];
  if (activeSprint) {
    sprintStories = await stories
      .find({ projectId, sprintId: activeSprint._id })
      .project({ _id: 1, title: 1, status: 1, points: 1, assigneeId: 1 }) // ADDED assigneeId
      .toArray();
  }

  return NextResponse.json({
    ...doc,
    activeSprint: activeSprint ? { id: activeSprint._id, name: activeSprint.name } : null,
    sprintStories: sprintStories.map(s => ({
      id: s._id,
      title: s.title,
      status: (s.status || "todo").toLowerCase(),
      points: s.points,
      assigneeId: s.assigneeId || null, // ADDED
    })),
  });
}

export async function POST(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id: projectId } = await resolveParams((ctx as any).params);

  const body = await req.json().catch(() => ({}));
  const titleRaw = String(body?.title || "").trim();
  const storyId = body?.storyId ? String(body.storyId) : null;
  if (!titleRaw && !storyId) return NextResponse.json({ error: "title or storyId required" }, { status: 400 });
  const status = (body?.status || "backlog").trim();
  const { projects, boards, stories } = await collections();
  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let finalTitle = titleRaw;
  if (storyId) {
    const story = await stories.findOne({ _id: storyId, projectId });
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    const existingLink = await boards.findOne({ projectId, storyId });
    if (existingLink) return NextResponse.json({ error: "Story already linked" }, { status: 409 });
    if (!finalTitle) finalTitle = story.title;
    // Se status for todo/doing/done, reflete na story
    if (["todo", "doing", "done"].includes(status)) {
      await stories.updateOne({ _id: storyId }, { $set: { status } });
    }
  }

  const count = await boards.countDocuments({ projectId, status });
  const now = new Date().toISOString();
  const doc = { _id: crypto.randomUUID(), projectId, title: finalTitle, status, order: count, createdBy: userId!, createdAt: now, updatedAt: now, storyId: storyId || undefined };
  await boards.insertOne(doc as any);
  return NextResponse.json(doc, { status: 201 });
}
