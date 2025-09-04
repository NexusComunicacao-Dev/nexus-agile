import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";
import clientPromise from "@/lib/mongodb";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const client = await clientPromise;
  const usersCol = client.db(process.env.MONGODB_DB).collection("users");
  const user = await usersCol.findOne({ email }) as { _id: any; email?: string } | null;
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { projects } = await collections();
  const proj = await projects.findOne({ _id: params.id, ownerId: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await projects.updateOne(
    { _id: params.id },
    { $addToSet: { memberIds: String(user._id) } }
  );
  const updated = await projects.findOne({ _id: params.id });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const memberId = String(searchParams.get("memberId") || "");
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

  const { projects } = await collections();
  const proj = await projects.findOne({ _id: params.id, ownerId: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await projects.updateOne({ _id: params.id }, { $pull: { memberIds: memberId } });
  const updated = await projects.findOne({ _id: params.id });
  return NextResponse.json(updated);
}
