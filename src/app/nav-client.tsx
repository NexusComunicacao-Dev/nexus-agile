"use client";

import { useSession } from "next-auth/react";

export default function NavClient() {
  const { data } = useSession();
  const isAdmin = Boolean((data?.user as any)?.admin);
  return (
    <div className="flex gap-4">
      <a href="/projects" className="hover:underline">Projetos</a>
      <a href="/board" className="hover:underline">Kanban</a>
      <a href="/poker" className="hover:underline">Planning Poker</a>
      <a href="/sprints" className="hover:underline">Sprints</a>
      {isAdmin && <a href="/admin" className="hover:underline text-foreground/90">Admin</a>}
    </div>
  );
}
