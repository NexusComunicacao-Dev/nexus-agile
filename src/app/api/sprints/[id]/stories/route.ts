import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { collections } from "@/lib/db";
import type { Story } from "@/lib/types";

// NEW: helper para lidar com params possivelmente async
async function resolveParams(p: any): Promise<{ id: string }> {
  return typeof p?.then === "function" ? await p : p;
}

export async function POST(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const { id: sprintId } = await resolveParams((ctx as any).params); // NEW

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const description =
    typeof body?.description === "string" && body.description.trim()
      ? body.description.trim()
      : undefined;

  const { sprints, stories } = await collections();

  const sprint = await sprints.findOne({ _id: sprintId, projectId: body.projectId, status: "active" });
  if (!sprint) return NextResponse.json({ error: "sprint not found or inactive" }, { status: 404 });

  const now = new Date().toISOString();
  const doc = {
    _id: crypto.randomUUID(),
    projectId: sprint.projectId,
    sprintId,
    title,
    description, // mantém se fornecida
    status: "todo",
    createdAt: now,
    history: [{ at: now, status: "todo" }],
  };
  await stories.insertOne(doc as any);
  return NextResponse.json(doc, { status: 201 });
}

// Caso existam outros handlers (GET / DELETE / etc.), aplicar o mesmo padrão:
// export async function GET(req: Request, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
//   const { id } = await resolveParams((ctx as any).params);
//   // ...existing code...
// }
