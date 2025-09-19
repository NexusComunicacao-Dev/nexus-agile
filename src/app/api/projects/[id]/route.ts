import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ObjectId } from "mongodb"; // NEW

// Helper para lidar com params possivelmente async
async function resolveParams(p: any): Promise<{ id: string }> {
  return typeof p?.then === "function" ? await p : p;
}

// GET projeto (assinatura ajustada)
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> } // UPDATED
) {
  const { id } = await context.params; // UPDATED
  const { userId, error } = await requireUser();
  if (error) return error;

  const url = new URL(req.url);
  const includeMembers = url.searchParams.get("includeMembers") === "1";

  const { projects } = await collections();
  const proj = await projects.findOne({ _id: id, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!includeMembers) return NextResponse.json(proj);

  try {
    const client = await clientPromise;
    const usersCol = client.db(process.env.MONGODB_DB).collection("users");

    // NEW: converter strings para ObjectId
    const objectIds = proj.memberIds
      .map((x: string) => {
        try {
          return new ObjectId(x);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as ObjectId[];

    let members: any[] = [];
    if (objectIds.length) {
      members = await usersCol
        .find({ _id: { $in: objectIds } })
        .project({ email: 1, name: 1 })
        .toArray();
    }

    return NextResponse.json({ project: proj, members });
  } catch {
    return NextResponse.json({ project: proj, members: [] });
  }
}

// PATCH projeto (se existir)
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> } // UPDATED
) {
  const { id } = await context.params; // UPDATED
  const { userId, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const { name } = body || {};
  const { projects } = await collections();
  const proj = await projects.findOne({ _id: id, ownerId: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await projects.updateOne({ _id: id }, { $set: { name: String(name || proj.name) } });
  const updated = await projects.findOne({ _id: id });
  return NextResponse.json(updated);
}

// DELETE projeto (se existir)
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> } // UPDATED
) {
  const { id } = await context.params; // UPDATED
  const { userId, error } = await requireUser();
  if (error) return error;

  let isAdmin = false;
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase();
    if (email) {
      const client = await clientPromise;
      const users = client.db(process.env.MONGODB_DB).collection("users");
      const u = await users.findOne({ email });
      isAdmin = Boolean((u as any)?.admin);
    }
  } catch {
    /* ignore */
  }

  const { projects, sprints, stories } = await collections();
  const proj = await projects.findOne({ _id: id });
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(isAdmin || proj.ownerId === userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await stories.deleteMany({ projectId: id });
  await sprints.deleteMany({ projectId: id });
  await projects.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}
