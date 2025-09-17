import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { collections } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { sessionId: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { pokerSessions, pokerVotes, projects } = await collections();
  const session = await pokerSessions.findOne({ _id: params.sessionId });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: session.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const votes = await pokerVotes.find({ sessionId: session._id }).toArray();
  return NextResponse.json({ session, votes });
}

export async function PATCH(req: Request, { params }: { params: { sessionId: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const { pokerSessions, pokerVotes, projects, stories } = await collections();
  const session = await pokerSessions.findOne({ _id: params.sessionId });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const proj = await projects.findOne({ _id: session.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (body.action === "vote") {
    const value = body.value ?? null;
    if (!(session.deck as any[]).includes(value) && value !== null) return NextResponse.json({ error: "invalid vote" }, { status: 400 });
    await pokerVotes.updateOne(
      { sessionId: session._id, userId: userId! },
      { $set: { value, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reveal") {
    if (session.ownerId !== userId) return NextResponse.json({ error: "Only owner can reveal" }, { status: 403 });
    const votes = await pokerVotes.find({ sessionId: session._id }).toArray();
    const numeric = votes.map(v => v.value).filter(v => typeof v === "number") as number[];
    const consensus = numeric.length ? Math.round(numeric.reduce((a,b)=>a+b,0)/numeric.length) : undefined;
    await pokerSessions.updateOne({ _id: session._id }, { $set: { status: "revealed", revealedAt: new Date().toISOString(), consensusPoints: consensus } });
    // opcional: atualizar story points
    if (consensus != null && session.storyId) {
      await stories.updateOne({ _id: session.storyId }, { $set: { points: consensus } });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "close") {
    if (session.ownerId !== userId) return NextResponse.json({ error: "Only owner can close" }, { status: 403 });
    await pokerSessions.updateOne({ _id: session._id }, { $set: { status: "closed" } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
