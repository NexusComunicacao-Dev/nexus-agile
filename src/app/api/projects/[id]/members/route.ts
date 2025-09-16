import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";
import clientPromise from "@/lib/mongodb";
import { sendMail } from "@/lib/mailer";

// Helper para resolver params (compatível com Next que pode entregar Promise)
async function resolveParams(p: any): Promise<{ id: string }> {
  return typeof p?.then === "function" ? p : p;
}

export async function POST(req: Request, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const { id } = await resolveParams((ctx as any).params);

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const usersCol = db.collection("users");
  const invitesCol = db.collection("project_invitations");

  const existingUser = await usersCol.findOne({ email });

  const { projects } = await collections();
  const proj = await projects.findOne({ _id: id, ownerId: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (!existingUser) {
    // Verifica se já há convite pendente
    const already = await invitesCol.findOne({ projectId: id, email, acceptedAt: { $exists: false } });
    if (!already) {
      await invitesCol.insertOne({
        _id: crypto.randomUUID(),
        projectId: id,
        email,
        invitedBy: userId!,
        createdAt: new Date().toISOString(),
      });
    }

    try {
      await sendMail({
        to: email,
        subject: `Convite para projeto ${proj.name}`,
        text: `Você foi convidado para o projeto "${proj.name}". Faça login para acessar: ${baseUrl}/projects`,
        html: `<p>Você foi convidado para o projeto <strong>${proj.name}</strong>.</p>
               <p>Faça login para aceitar automaticamente: <a href="${baseUrl}/projects" target="_blank" rel="noopener">${baseUrl}/projects</a></p>
               <p>— Nexus Agile</p>`,
      });
    } catch (e) {
      console.warn("Failed to send invite email", e);
    }

    return NextResponse.json({ invited: true, email });
  }

  // Usuário já existe: adiciona diretamente
  await projects.updateOne(
    { _id: id },
    { $addToSet: { memberIds: String(existingUser._id) } }
  );
  const updated = await projects.findOne({ _id: id });

  try {
    await sendMail({
      to: email,
      subject: `Você foi adicionado ao projeto ${proj?.name}`,
      text: `Olá${existingUser?.name ? " " + existingUser.name : ""}, você agora é membro do projeto "${proj?.name}". Acesse: ${baseUrl}/projects`,
      html: `<p>Olá${existingUser?.name ? " <strong>" + existingUser.name + "</strong>" : ""},</p>
             <p>Você foi adicionado ao projeto <strong>${proj?.name}</strong>.</p>
             <p><a href="${baseUrl}/projects" target="_blank" rel="noopener">Abrir a aplicação</a></p>
             <p>— Nexus Agile</p>`,
    });
  } catch (e) {
    console.warn("Failed to send member notification email", e);
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const { id } = await resolveParams((ctx as any).params);

  const { searchParams } = new URL(req.url);
  const memberId = String(searchParams.get("memberId") || "");
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

  const { projects } = await collections();
  const proj = await projects.findOne({ _id: id, ownerId: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await projects.updateOne({ _id: id }, { $pull: { memberIds: memberId } });
  const updated = await projects.findOne({ _id: id });
  return NextResponse.json(updated);
}
