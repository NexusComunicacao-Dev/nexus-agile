"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function Home() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <section className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="text-3xl font-bold">Nexus Agile</h1>
        <p className="text-sm text-foreground/70">
          Plataforma leve para planejamento de trabalho: Kanban, Planning Poker e
          gestão de Sprints com métricas (Lead Time).
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-5">
          <h2 className="mb-2 text-sm font-semibold">Comece por aqui</h2>
          <ul className="grid gap-2 text-sm">
            <li>
              • Gerencie seu backlog e inicie sprints em{" "}
              <a className="underline hover:opacity-80" href="/sprints">
                Sprints
              </a>
              .
            </li>
            <li>
              • Arraste histórias entre colunas no{" "}
              <a className="underline hover:opacity-80" href="/board">
                Kanban
              </a>
              .
            </li>
            <li>
              • Estime histórias com{" "}
              <a className="underline hover:opacity-80" href="/poker">
                Planning Poker
              </a>
              .
            </li>
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/projects"
              className="rounded-md bg-foreground px-4 py-2 text-background text-sm font-medium hover:opacity-90"
            >
              Ir para Projetos
            </a>
            <a
              href="/board"
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm hover:bg-foreground/5"
            >
              Abrir Kanban
            </a>
            <a
              href="/poker"
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm hover:bg-foreground/5"
            >
              Planning Poker
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-5">
          <h2 className="mb-2 text-sm font-semibold">
            {user ? "Sessão" : "Entrar"}
          </h2>
          {!user ? (
            <div className="grid gap-3">
              <button
                onClick={() => signIn(undefined, { callbackUrl: "/projects" })}
                className="h-9 rounded-md bg-foreground px-3 text-background text-sm font-medium hover:opacity-90"
              >
                Entrar
              </button>
              <p className="text-[11px] text-foreground/60">
                Usa Auth.js (OAuth se configurado; Credentials em dev).
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="text-sm">
                Olá,{" "}
                <span className="font-semibold">{user.name || "Usuário"}</span>
                {user.email ? (
                  <span className="text-foreground/60"> • {user.email}</span>
                ) : null}
              </div>
              <div className="flex gap-2">
                <a
                  href="/projects"
                  className="rounded-md bg-foreground px-3 py-2 text-background text-sm font-medium hover:opacity-90"
                >
                  Ir para Projetos
                </a>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-md border border-foreground/20 px-3 py-2 text-sm hover:bg-foreground/5"
                >
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}