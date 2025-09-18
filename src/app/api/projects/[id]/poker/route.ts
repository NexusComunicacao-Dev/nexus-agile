import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { collections } from "@/lib/db";
import { ObjectId } from "mongodb";

async function resolveParams(p: any): Promise<{ id: string }> {
  return typeof p?.then === "function" ? await p : p;
}
function buildSessionName(projectName: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Planning Poker • ${projectName} • ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function GET(req: Request, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const { id: projectId } = await resolveParams((ctx as any).params);
  const { userId, error } = await requireUser();
  if (error) return error;

  const { projects, stories, pokerSessions, pokerVotes } = await collections();
  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let session = await pokerSessions.findOne({ projectId, status: "active" });
  if (session && (!session.name || !session.shortCode)) {
    await pokerSessions.updateOne(
      { _id: session._id },
      { $set: { name: session.name || buildSessionName(proj.name), shortCode: session.shortCode || String(session._id).slice(0, 6).toUpperCase() } }
    );
    session = await pokerSessions.findOne({ _id: session._id });
  }

  const allStories = await stories.find({ projectId }).toArray();
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  allStories.sort((a: any, b: any) => {
    const ap = a.points == null ? 0 : 1;
    const bp = b.points == null ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const pa = priorityOrder[a.priority] ?? 9;
    const pb = priorityOrder[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  let votes: any[] = [];
  if (session?.activeStoryId) {
    votes = await pokerVotes.find({ sessionId: session._id, storyId: session.activeStoryId }).toArray();
    // NEW: lookup nomes
    const userIds = [...new Set(votes.map(v => v.userId).filter(Boolean))];
    if (userIds.length) {
      const asObjectIds = userIds
        .map(id => {
          try { return new ObjectId(id); } catch { return null; }
        })
        .filter(Boolean) as ObjectId[];
      const usersCol = (await collections()).db.collection("users");
      const userDocs = await usersCol
        .find({ _id: { $in: asObjectIds } })
        .project({ name: 1, email: 1 })
        .toArray();
      const map = new Map(userDocs.map((u: any) => [String(u._id), u.name || u.email]));
      votes = votes.map(v => ({ ...v, userName: map.get(v.userId) || v.userId }));
    }
  }

  return NextResponse.json({
    session,
    votes,
    stories: allStories.map((s: any) => ({ ...s, id: s._id || s.id })),
    project: { id: proj._id, name: proj.name },
  });
}

export async function POST(req: Request, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const { id: projectId } = await resolveParams((ctx as any).params);
  const { userId, error } = await requireUser();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const explicitName = (body?.name || "").toString().trim().slice(0, 160);

  const { projects, pokerSessions } = await collections();
  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await pokerSessions.findOne({ projectId, status: "active" });
  if (existing) return NextResponse.json(existing);

  const _id = crypto.randomUUID();
  const doc = {
    _id,
    projectId,
    name: explicitName || buildSessionName(proj.name),
    shortCode: _id.slice(0, 6).toUpperCase(),
    status: "active",
    activeStoryId: null,
    revealed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await pokerSessions.insertOne(doc as any);
  return NextResponse.json(doc, { status: 201 });
}

export async function PATCH(req: Request, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const { id: projectId } = await resolveParams((ctx as any).params);
  const { userId, error } = await requireUser();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");
  const storyId = body?.storyId ? String(body.storyId) : null;

  const { projects, pokerSessions, pokerVotes } = await collections();
  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await pokerSessions.findOne({ projectId, status: "active" });
  if (!session) return NextResponse.json({ error: "No active session" }, { status: 404 });

  const update: any = { updatedAt: new Date().toISOString() };

  if (action === "selectStory") {
    update.activeStoryId = storyId;
    update.revealed = false;
    if (storyId) {
      await pokerVotes.deleteMany({ sessionId: session._id, storyId });
    }
  } else if (action === "reveal") {
    update.revealed = true;
  } else if (action === "resetVotes") {
    if (!session.activeStoryId) return NextResponse.json({ error: "No active story" }, { status: 400 });
    await pokerVotes.deleteMany({ sessionId: session._id, storyId: session.activeStoryId });
    update.revealed = false;
  } else if (action === "close") {
    update.status = "closed";
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await pokerSessions.updateOne({ _id: session._id }, { $set: update });
  const next = await pokerSessions.findOne({ _id: session._id });
  return NextResponse.json(next);
}
