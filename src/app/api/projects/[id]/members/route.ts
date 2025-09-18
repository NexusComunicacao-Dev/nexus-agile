import { NextResponse } from "next/server";
import { collections } from "@/lib/db";
import { requireUser } from "@/lib/require-auth";
import clientPromise from "@/lib/mongodb";
import { sendMail } from "@/lib/mailer";
import { buildEmailTemplate } from "@/lib/email-template";
import { ObjectId } from "mongodb";

// Helper para resolver params (compatível com Next que pode entregar Promise)
async function resolveParams(p: any): Promise<{ id: string }> {
  return typeof p?.then === "function" ? await p : p; // FIX: agora aguarda
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
      const { html, text } = buildEmailTemplate({
        title: `Convite • ${proj.name}`,
        preheader: `Você foi convidado para o projeto ${proj.name}`,
        heading: "Convite para Projeto",
        body: [
          `Você foi convidado para participar do projeto "${proj.name}".`,
          "Ao acessar a aplicação com este e-mail, seu acesso será liberado automaticamente.",
        ],
        ctaLabel: "Acessar Nexus Agile",
        ctaUrl: `${baseUrl}/projects`,
        footerNote: "Se você não esperava este convite, pode ignorar este e-mail.",
      });
      await sendMail({
        to: email,
        subject: `Convite para projeto ${proj.name}`,
        text,
        html,
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
    const { html, text } = buildEmailTemplate({
      title: `Adicionado • ${proj?.name}`,
      preheader: `Você agora faz parte do projeto ${proj?.name}`,
      heading: "Acesso Concedido",
      body: [
        `Olá${existingUser?.name ? ` ${existingUser.name}` : ""},`,
        `Você foi adicionado ao projeto "${proj?.name}".`,
        "Clique abaixo para abrir o painel de projetos.",
      ],
      ctaLabel: "Abrir Projetos",
      ctaUrl: `${baseUrl}/projects`,
      footerNote: "Caso não reconheça esta ação, entre em contato com um administrador.",
    });
    await sendMail({
      to: email,
      subject: `Você foi adicionado ao projeto ${proj?.name}`,
      text,
      html,
    });
  } catch (e) {
    console.warn("Failed to send member notification email", e);
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const { id } = await resolveParams((ctx as any).params);

  const { searchParams } = new URL(req.url);
  const memberId = String(searchParams.get("memberId") || "");
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

  const { projects, db } = await collections(); // UPDATED para ter db
  const proj = await projects.findOne({ _id: id, ownerId: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // NEW: capturar dados do usuário antes de remover
  const usersCol = db.collection("users");
  let removedUser: any = await usersCol.findOne({ _id: memberId });
  if (!removedUser) {
    try {
      removedUser = await usersCol.findOne({ _id: new ObjectId(memberId) });
    } catch {
      /* ignore */
    }
  }

  await projects.updateOne({ _id: id }, { $pull: { memberIds: memberId } });
  const updated = await projects.findOne({ _id: id });

  return NextResponse.json({
    ok: true,
    project: updated,
    removed: removedUser
      ? {
          id: memberId,
            name: removedUser.name || removedUser.email || null,
            email: removedUser.email || null,
        }
      : { id: memberId, name: null, email: null }
  });
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id: projectId } = await resolveParams((ctx as any).params);
  const { projects, db } = await collections();
  const proj = await projects.findOne({ _id: projectId, memberIds: userId! });
  if (!proj) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const memberIds: string[] = Array.isArray(proj.memberIds) ? proj.memberIds : [];
  if (!memberIds.length) {
    return NextResponse.json({ members: [] });
  }

  // Converte para ObjectId quando possível
  const objectIds: ObjectId[] = [];
  for (const id of memberIds) {
    try {
      objectIds.push(new ObjectId(id));
    } catch {
      // ignora (talvez _id seja string em ambiente de testes)
    }
  }

  const usersCol = db.collection("users");
  let users: any[] = [];
  if (objectIds.length) {
    users = await usersCol
      .find({ _id: { $in: objectIds } })
      .project({ name: 1, email: 1 })
      .toArray();
  }

  // Fallback: se não retornou nada e temos ids que não viraram ObjectId, tenta match direto por _id string
  if (!users.length && objectIds.length !== memberIds.length) {
    users = await usersCol
      .find({ _id: { $in: memberIds } })
      .project({ name: 1, email: 1 })
      .toArray();
  }

  return NextResponse.json({
    members: users.map((u: any) => ({
      id: String(u._id),
      name: u.name || u.email,
      email: u.email,
      initials: initials(u.name, u.email),
    })),
  });
}

function initials(name?: string, email?: string) {
  if (name) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]).join("").toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}
