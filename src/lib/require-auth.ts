import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { userId: null as string | null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  // @ts-ignore
  const userId = String(session.user.id || session.user.sub || "");
  if (!userId) {
    return { userId: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId, error: null as any };
}
