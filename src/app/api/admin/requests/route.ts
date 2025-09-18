import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { buildEmailTemplate } from "@/lib/email-template";
import { sendMail } from "@/lib/mailer";

type AdminRequest = {
  _id: string;
  userId: string;
  email: string;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
};

async function isAdmin(email?: string | null) {
  if (!email) return false;
  const client = await clientPromise;
  const users = client.db(process.env.MONGODB_DB).collection("users");
  const doc = await users.findOne({ email: email.toLowerCase() });
  return Boolean(doc?.admin);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  const userId = (session?.user as any)?.id;
  if (!email || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reason = String(body?.reason || "").slice(0, 500);

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const col = db.collection("admin_requests");

  // evita duplicar pendente
  const existing = await col.findOne({ email, status: "pending" });
  if (existing) return NextResponse.json(existing, { status: 200 });

  const now = new Date().toISOString();
  const doc: AdminRequest = {
    _id: crypto.randomUUID(),
    userId,
    email,
    reason: reason || undefined,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(doc as any);

  // notifica admins
  try {
    const usersCol = db.collection("users");
    const admins = await usersCol.find({ admin: true }).toArray();
    const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    // SUBSTITUI bloco anterior de envio simples por template estilizado
    if (admins.length) {
      const { html, text } = buildEmailTemplate({
        title: "Pedido de acesso de admin",
        preheader: `Novo pedido de admin de ${email}`,
        heading: "Novo Pedido de Acesso Admin",
        body: [
          `Usuário: ${email}`,
          reason ? `Motivo informado: "${reason}"` : "Nenhum motivo fornecido.",
          "Acesse o painel de pedidos para aprovar ou rejeitar."
        ],
        ctaLabel: "Rever Pedidos",
        ctaUrl: `${baseUrl}/admin/requests`,
        footerNote: "Você está recebendo este e-mail por ser administrador do Nexus Agile."
      });

      await Promise.all(
        admins.map((a: { email: string }) =>
          sendMail({
            to: a.email,
            subject: "Nexus Agile • Novo pedido de admin",
            html,
            text,
          }).catch(() => {})
        )
      );
    }
  } catch (e) {
    console.warn("Failed to send admin request notification", e);
  }

  return NextResponse.json(doc, { status: 201 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!(await isAdmin(email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const col = db.collection("admin_requests");
  const list = await col.find().sort({ createdAt: -1 }).limit(200).toArray();
  return NextResponse.json(list);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!(await isAdmin(email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  const status = body?.status;
  if (!id || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const col = db.collection("admin_requests");
  const now = new Date().toISOString();

  await col.updateOne({ _id: id }, { $set: { status, updatedAt: now } });
  const updated = await col.findOne({ _id: id });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}
