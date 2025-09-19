import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { collections } from "@/lib/db";

export async function POST(req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { sessionId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const forced = body?.points != null ? Number(body.points) : null;

  const { pokerSessions, pokerVotes, stories, projects } = await collections();
  const session = await pokerSessions.findOne({ _id: sessionId });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!session.activeStoryId) return NextResponse.json({ error: "No active story" }, { status: 400 });

  const proj = await projects.findOne({ _id: session.projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const votes = await pokerVotes.find({ sessionId, storyId: session.activeStoryId }).toArray();
  const numeric = votes
    .map((v: any) => v.value)
    .filter((v: string) => /^\d+$/.test(v))
    .map((v: string) => Number(v));

  let points = forced;
  if (points == null) {
    if (!numeric.length) return NextResponse.json({ error: "No numeric votes" }, { status: 400 });
    const avg = numeric.reduce((a: number, b: number) => a + b, 0) / numeric.length;
    points = Number(avg.toFixed(1));
  }
  await stories.updateOne({ _id: session.activeStoryId }, { $set: { points } });
  return NextResponse.json({ ok: true, storyId: session.activeStoryId, points });
}
