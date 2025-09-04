import type { NextAuthOptions } from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "./mongodb";
import GoogleProvider from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

function parseList(v?: string) {
  return (v || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}
function isEmailAllowed(email?: string | null) {
  const allowedEmails = parseList(process.env.ALLOWED_EMAILS);
  const allowedDomains = parseList(process.env.ALLOWED_EMAIL_DOMAINS);
  if (!email) return allowedEmails.length === 0 && allowedDomains.length === 0; // abre se nada configurado
  const e = email.toLowerCase();
  if (allowedEmails.includes(e)) return true;
  const domain = e.split("@")[1];
  if (domain && allowedDomains.includes(domain)) return true;
  // se nenhuma lista configurada, permite
  if (allowedEmails.length === 0 && allowedDomains.length === 0) return true;
  return false;
}

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise, {
    // use the same database as the app (prevents creating 'test')
    databaseName: process.env.MONGODB_DB,
  }),
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    Credentials({
      name: "Dev Login",
      credentials: {
        name: { label: "Name", type: "text" },
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const name = String(credentials?.name || "").trim();
        const email = String(credentials?.email || "").trim();
        if (!name) return null;
        return { id: email || name, name, email: email || undefined };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const ok = isEmailAllowed(user?.email || null);
      return ok;
    },
    async session({ session, token }) {
      if (session?.user && token?.sub) {
        (session.user as any).id = token.sub;
      }
      // NEW: include admin flag from users collection
      try {
        const email = session?.user?.email?.toLowerCase();
        if (email) {
          const client = await clientPromise;
          const users = client.db(process.env.MONGODB_DB).collection("users");
          const doc = await users.findOne({ email });
          (session.user as any).admin = Boolean(doc?.admin);
        } else {
          (session.user as any).admin = false;
        }
      } catch {
        (session.user as any).admin = false;
      }
      return session;
    },
  },
  events: {
    // Auto-promote on first sign-in if email is in ADMIN_SEED_EMAILS or no admin exists yet (bootstrap)
    async signIn({ user }) {
      try {
        const email = user?.email?.toLowerCase();
        if (!email) return;
        const client = await clientPromise;
        const db = client.db(process.env.MONGODB_DB);
        const users = db.collection("users");

        const seed = parseList(process.env.ADMIN_SEED_EMAILS);
        if (seed.includes(email)) {
          await users.updateOne({ email }, { $set: { admin: true } });
          return;
        }

        const count = await users.countDocuments({ admin: true });
        if (count === 0) {
          await users.updateOne({ email }, { $set: { admin: true } });
        }
      } catch {
        // ignore
      }
    },
  },
};
