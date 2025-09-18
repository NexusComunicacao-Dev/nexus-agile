import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// NEW helper para lidar com params possivelmente assíncronos
async function resolveParams(p: any): Promise<{ id: string }> {
  return typeof p?.then === "function" ? await p : p;
}

const LEAD_TARGET_DAYS = 7; // NEW alvo (lead time esperado)

// NEW util para formatar ms em dias (número com 2 casas)
function msToDays(ms: number) {
  return +(ms / 86400000).toFixed(2);
}

// NEW cálculo de métricas por história
function computeStoryLeadMetrics(story: any) {
  const history: { status: string; at: string }[] = Array.isArray(story.history) ? story.history.slice() : [];
  history.sort((a,b)=>new Date(a.at).getTime()-new Date(b.at).getTime());
  if (!history.length) return null;

  const perStatus: Record<string, { ms: number; days: number }> = {};
  const orderStatuses = ["todo","doing","testing","awaiting deploy","deployed","done"];
  const now = Date.now();

  for (let i=0; i<history.length; i++) {
    const cur = history[i];
    const start = new Date(cur.at).getTime();
    const end = i < history.length - 1 ? new Date(history[i+1].at).getTime() : now;
    const span = Math.max(0, end - start);
    if (!perStatus[cur.status]) perStatus[cur.status] = { ms: 0, days: 0 };
    perStatus[cur.status].ms += span;
  }

  // Garante chaves com 0 para todos status do fluxo
  for (const st of orderStatuses) {
    if (!perStatus[st]) perStatus[st] = { ms: 0, days: 0 };
    perStatus[st].days = msToDays(perStatus[st].ms);
  }

  // Total: se história chegou em 'done', usar tempo entre primeiro evento e mudança para done; senão até agora
  const firstTs = new Date(history[0].at).getTime();
  const doneEvent = history.find(h => h.status === "done");
  const endTs = doneEvent ? new Date(doneEvent.at).getTime() : now;
  const totalMs = Math.max(0, endTs - firstTs);
  const totalDays = msToDays(totalMs);
  const varianceDays = +(totalDays - LEAD_TARGET_DAYS).toFixed(2);

  return {
    perStatus,
    total: { ms: totalMs, days: totalDays },
    targetDays: LEAD_TARGET_DAYS,
    varianceDays,
    withinTarget: totalDays <= LEAD_TARGET_DAYS
  };
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id } = await resolveParams((ctx as any).params);
  const { sprints, projects, stories } = await collections();
  const sprint = await sprints.findOne({ _id: id });
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: sprint.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // INCLUDE history no projection
  const sprintStories = await stories
    .find({ sprintId: sprint._id })
    .project({ _id: 1, title: 1, status: 1, points: 1, assigneeId: 1, history: 1 })
    .toArray();

  const totalStories = sprintStories.length;
  const doneStories = sprintStories.filter((s: any) => s.status === "done").length;
  const totalPoints = sprintStories.reduce((a: number, s: { points?: number }) => a + (typeof s.points === "number" ? s.points : 0), 0);
  const completedPoints = sprintStories
    .filter((s: { status: string }) => s.status === "done")
    .reduce((a: number, s: { points?: number }) => a + (typeof s.points === "number" ? s.points : 0), 0);

  // NEW: métricas de lead time por história
  const storyMetrics = sprintStories.map((s: { _id: string; history?: any[] }) => {
    const lead = computeStoryLeadMetrics(s);
    return {
      id: s._id,
      lead
    };
  });

  // NEW: agregados de lead time
  const validLeads = storyMetrics.map((m: { lead: any }) => m.lead).filter(Boolean) as any[];
  const avgLeadDays = validLeads.length
    ? +(validLeads.reduce((a:number,l:any)=>a + l.total.days, 0) / validLeads.length).toFixed(2)
    : 0;
  const withinTargetCount = validLeads.filter(l => l.withinTarget).length;

  const metrics = {
    totalStories,
    doneStories,
    totalPoints,
    completedPoints,
    progressPct: totalStories ? +((doneStories / totalStories) * 100).toFixed(1) : 0,
    velocity: completedPoints,
    avgLeadDays,                 // NEW
    leadTargetDays: LEAD_TARGET_DAYS, // NEW
    leadWithinTarget: withinTargetCount, // NEW
    leadWithinTargetPct: validLeads.length ? +((withinTargetCount / validLeads.length) * 100).toFixed(1) : 0 // NEW
  };

  return NextResponse.json({
    sprint,
    project: { id: proj._id, name: proj.name },
    metrics,
    stories: sprintStories.map((s: { _id: string; title: string; status: string; points?: number; assigneeId?: string; }) => ({
      id: s._id,
      title: s.title,
      status: s.status,
      points: s.points,
      assigneeId: s.assigneeId || null,
      lead: storyMetrics.find((m: { id: string }) => m.id === s._id)?.lead || null // NEW: inclui métricas no objeto da história
    })),
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id } = await resolveParams((ctx as any).params); // UPDATED
  const body = await req.json().catch(() => ({}));
  const session = await getServerSession(authOptions);
  const isAdmin = Boolean((session?.user as any)?.admin);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { sprints, projects } = await collections();
  const sprint = await sprints.findOne({ _id: id }); // UPDATED
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: sprint.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updates: any = {};
  if (body.status === "completed") {
    updates.status = "completed";
    updates.completedAt = new Date().toISOString();
  }
  if (body.name) updates.name = String(body.name).trim();
  if (body.goal !== undefined) updates.goal = String(body.goal || "").trim() || undefined;
  if (Object.keys(updates).length === 0) return NextResponse.json(sprint);

  await sprints.updateOne({ _id: sprint._id }, { $set: updates });
  const updated = await sprints.findOne({ _id: sprint._id });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id } = await resolveParams((ctx as any).params); // UPDATED
  const { sprints, projects } = await collections();
  const sprint = await sprints.findOne({ _id: id }); // UPDATED
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: sprint.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await sprints.deleteOne({ _id: sprint._id });
  return NextResponse.json({ deleted: true });
}
