import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { collections } from "@/lib/db";
import { ObjectId } from "mongodb";

async function resolveParams(p: any): Promise<{ sessionId: string }> {
  return typeof p?.then === "function" ? await p : p;
}

export async function GET(
  _: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { sessionId } = await context.params;
  const { pokerSessions, pokerVotes, projects } = await collections();

  const session = await pokerSessions.findOne({ _id: sessionId });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const proj = await projects.findOne({ _id: session.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let votes: any[] = [];
  if (session.activeStoryId) {
    votes = await pokerVotes.find({ sessionId, storyId: session.activeStoryId }).toArray();
    // NEW enrich
    const userIds = [...new Set(votes.map(v => v.userId).filter(Boolean))];
    if (userIds.length) {
      const oid = userIds.map(i => { try { return new ObjectId(i as string); } catch { return null; } }).filter(Boolean) as ObjectId[];
      const usersCol = (await collections()).db.collection("users");
      const docs = await usersCol.find({ _id: { $in: oid } }).project({ name:1, email:1 }).toArray();
      const map = new Map(docs.map((d: any) => [String(d._id), d.name || d.email]));
      votes = votes.map((v: any) => ({ ...v, userName: map.get(v.userId) || v.userId }));
    }
  }
  return NextResponse.json({ session, votes });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { sessionId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const value = String(body?.value || "").trim();

  const { pokerSessions, pokerVotes, projects } = await collections();
  const session = await pokerSessions.findOne({ _id: sessionId });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!session.activeStoryId) return NextResponse.json({ error: "No active story" }, { status: 400 });

  const proj = await projects.findOne({ _id: session.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (session.revealed) return NextResponse.json({ error: "Session revealed" }, { status: 409 });

  const filter = { sessionId, userId: userId!, storyId: session.activeStoryId };
  const now = new Date().toISOString();

  async function doUpdate() {
    await pokerVotes.updateOne(
      filter,
      {
        $set: { value, updatedAt: now },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );
  }

  try {
    await doUpdate();
  } catch (e: any) {
    if (e?.code === 11000) {
      // Possível índice legado sem storyId: tenta corrigir removendo voto anterior sem storyId
      await pokerVotes.deleteMany({ sessionId, userId: userId!, storyId: { $exists: false } }).catch(() => {});
      try {
        await doUpdate();
      } catch (e2: any) {
        return NextResponse.json({ error: "Duplicate vote conflict (index mismatch). Limpe índices antigos de poker_votes." }, { status: 409 });
      }
    } else {
      return NextResponse.json({ error: "Write error" }, { status: 500 });
    }
  }

  const votesRaw = await pokerVotes.find({ sessionId, storyId: session.activeStoryId }).toArray();
  // NEW enrich
  let votes = votesRaw;
  if (votes.length) {
    const userIds = [...new Set(votes.map((v: any) => v.userId).filter(Boolean))];
    const oid = userIds.map(i => { try { return new ObjectId(i as string); } catch { return null; } }).filter(Boolean) as ObjectId[];
    const usersCol = (await collections()).db.collection("users");
    const docs = await usersCol.find({ _id: { $in: oid } }).project({ name:1, email:1 }).toArray();
    const map = new Map(docs.map((d: any) => [String(d._id), d.name || d.email]));
    votes = votes.map((v: any) => ({ ...v, userName: map.get(v.userId) || v.userId }));
  }
  return NextResponse.json({ ok: true, votes });
}
