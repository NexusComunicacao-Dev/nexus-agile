import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

// Usage:
// - POST   /api/admin/users   { "email": "user@company.com" }  -> promote to admin
// - DELETE /api/admin/users   { "email": "user@company.com" }  -> demote (remove admin)
// Protection:
// - Requires authenticated session.
// - Bootstrap: if there is no admin yet, the logged-in user can promote themselves.
// - Seed: ADMIN_SEED_EMAILS can list emails allowed to promote initially.
// Notes:
// - After changing admin, re-login to refresh session claims.

function parseList(v?: string) {
  return (v || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

async function isAdmin(email?: string | null) {
  if (!email) return false;
  const client = await clientPromise;
  const users = client.db(process.env.MONGODB_DB).collection("users");
  const doc = await users.findOne({ email: email.toLowerCase() });
  return Boolean(doc?.admin);
}

async function adminsCount() {
  const client = await clientPromise;
  const users = client.db(process.env.MONGODB_DB).collection("users");
  return users.countDocuments({ admin: true });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const actorEmail = session?.user?.email?.toLowerCase() || null;
  if (!actorEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").toLowerCase().trim();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const seed = parseList(process.env.ADMIN_SEED_EMAILS);
  const actorIsAdmin = await isAdmin(actorEmail);
  const count = await adminsCount();

  // Permite bootstrap: se não há admin ainda, o usuário pode se promover.
  const bootstrapAllowed = count === 0 && email === actorEmail;
  // Também permite se o e-mail do ator estiver na lista de seed
  const seedAllowed = seed.includes(actorEmail);

  if (!actorIsAdmin && !bootstrapAllowed && !seedAllowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = await clientPromise;
  const users = client.db(process.env.MONGODB_DB).collection("users");
  const exists = await users.findOne({ email });
  if (!exists) return NextResponse.json({ error: "user not found (login required first)" }, { status: 404 });

  await users.updateOne({ email }, { $set: { admin: true } });
  return NextResponse.json({ ok: true, email, admin: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const actorEmail = session?.user?.email?.toLowerCase() || null;
  if (!actorEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").toLowerCase().trim();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const actorIsAdmin = await isAdmin(actorEmail);
  if (!actorIsAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const client = await clientPromise;
  const users = client.db(process.env.MONGODB_DB).collection("users");
  const target = await users.findOne({ email });
  if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const count = await adminsCount();
  // Impede remover o último admin
  if (target.admin && count <= 1) {
    return NextResponse.json({ error: "cannot demote the last admin" }, { status: 400 });
  }

  await users.updateOne({ email }, { $set: { admin: false } });
  return NextResponse.json({ ok: true, email, admin: false });
}
