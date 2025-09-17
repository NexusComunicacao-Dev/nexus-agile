import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { collections } from "@/lib/db";

const DEFAULT_DECK: (number | "?")[] = [1,2,3,5,8,13,21,"?"];

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const projectId = params.id;
  const { projects, pokerSessions } = await collections();
  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sessions = await pokerSessions.find({ projectId }).sort({ createdAt: -1 }).limit(30).toArray();
  return NextResponse.json(sessions);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const projectId = params.id;
  const body = await req.json().catch(() => ({}));
  const deck = Array.isArray(body.deck) && body.deck.length ? body.deck : DEFAULT_DECK;
  const storyId = body.storyId ? String(body.storyId) : undefined;
  const { projects, pokerSessions } = await collections();
  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date().toISOString();
  const session = { _id: crypto.randomUUID(), projectId, storyId, ownerId: userId!, status: "active", deck, createdAt: now };
  await pokerSessions.insertOne(session as any);
  return NextResponse.json(session, { status: 201 });
}
