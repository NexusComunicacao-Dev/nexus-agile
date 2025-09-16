import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { sendMail } from "@/lib/mailer";

async function isAdmin(email?: string | null) {
  if (!email) return false;
  const client = await clientPromise;
  const users = client.db(process.env.MONGODB_DB).collection("users");
  const doc = await users.findOne({ email: email.toLowerCase() });
  return Boolean(doc?.admin);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!(await isAdmin(email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const invitesCol = db.collection("project_invitations");
  const projectsCol = db.collection("projects");

  const invites = await invitesCol
    .find({ acceptedAt: { $exists: false }, canceledAt: { $exists: false } })
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();

  const projectIds = [...new Set(invites.map((i: { projectId: string }) => i.projectId))];
  const projects = await projectsCol
    .find({ _id: { $in: projectIds } })
    .project({ _id: 1, name: 1 })
    .toArray();
  const nameMap = new Map(projects.map((p: { _id: string; name: string }) => [p._id, p.name]));

  const data = invites.map((i: { _id: string; email: string; projectId: string; invitedBy: string; createdAt: string }) => ({
    id: i._id,
    email: i.email,
    projectId: i.projectId,
    projectName: nameMap.get(i.projectId) || "(removido)",
    invitedBy: i.invitedBy,
    createdAt: i.createdAt,
  }));

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!(await isAdmin(email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const invitesCol = db.collection("project_invitations");
  const projectsCol = db.collection("projects");

  const invite = await invitesCol.findOne({
    _id: id,
    acceptedAt: { $exists: false },
  });
  if (!invite) return NextResponse.json({ error: "Not found or already accepted" }, { status: 404 });

  const project = await projectsCol.findOne({ _id: invite.projectId });
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

  try {
    await sendMail({
      to: invite.email,
      subject: `Reenvio de convite – Projeto ${project?.name || invite.projectId}`,
      text: `Você ainda possui um convite pendente para o projeto "${project?.name || invite.projectId}". Acesse: ${baseUrl}/projects`,
      html: `<p>Reenvio de convite para o projeto <strong>${project?.name || invite.projectId}</strong>.</p>
             <p>Faça login para aceitar automaticamente: <a href="${baseUrl}/projects" target="_blank" rel="noopener">${baseUrl}/projects</a></p>
             <p>— Nexus Agile</p>`,
    });
  } catch (e) {
    console.warn("Failed to resend invite email", e);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!(await isAdmin(email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const invitesCol = db.collection("project_invitations");

  const invite = await invitesCol.findOne({ _id: id, acceptedAt: { $exists: false }, canceledAt: { $exists: false } });
  if (!invite) return NextResponse.json({ error: "Not found or already processed" }, { status: 404 });

  await invitesCol.updateOne({ _id: id }, { $set: { canceledAt: new Date().toISOString() } });
  return NextResponse.json({ ok: true });
}
