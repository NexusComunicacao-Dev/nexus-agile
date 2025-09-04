import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";
import type { Project } from "@/lib/types";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { projects } = await collections();
  const list = await projects
    .find({ memberIds: userId })
    .sort({ createdAt: -1 })
    .toArray();
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;

  // NEW: gate project creation — if env disabled, require admin user
  if (process.env.ALLOW_PROJECT_SELF_CREATE !== "true") {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase();
    let isAdmin = false;
    if (email) {
      const client = await clientPromise;
      const users = client.db(process.env.MONGODB_DB).collection("users");
      const doc = await users.findOne({ email }) as { admin?: boolean } | null;
      isAdmin = Boolean(doc?.admin);
    }
    if (!isAdmin) {
      return NextResponse.json({ error: "Only admins can create projects" }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const key = String(body?.key || "").trim().toUpperCase();
  if (!name || !key) return NextResponse.json({ error: "name and key are required" }, { status: 400 });

  const now = new Date().toISOString();
  const proj: Project = {
    _id: crypto.randomUUID(),
    name,
    key,
    ownerId: userId!,
    memberIds: [userId!],
    createdAt: now,
  };
  const { projects } = await collections();
  await projects.insertOne(proj as any).catch((e: unknown) => {
    if (String((e as any)?.code) === "11000") {
      throw NextResponse.json({ error: "key already exists" }, { status: 409 });
    }
    throw e;
  });
  return NextResponse.json(proj, { status: 201 });
}
