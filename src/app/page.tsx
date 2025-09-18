"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function Home() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <section className="grid gap-10">
      {/* HERO */}
      <div className="relative rounded-2xl card-surface p-[2px] ">
        <div className="rounded-[1.05rem] backdrop-blur-sm p-8 grid gap-4">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="badge-brand">Nexus</span>
            <span>Bem-vindo(a) {user?.name ? `• ${user.name}` : ""}</span>
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Seu espaço de trabalho está pronto. Vamos começar?
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href="/projects" className="btn-primary h-10 px-5 text-sm">
              Projetos
            </a>
            <a
              href="/board"
              className="h-10 rounded-md border border-border px-4 text-sm hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition"
            >
              Board
            </a>
            <a
              href="/poker"
              className="h-10 rounded-md border border-border px-4 text-sm hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition"
            >
              Planning Poker
            </a>
            <a
              href="/sprints"
              className="h-10 rounded-md border border-border px-4 text-sm hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition"
            >
              Sprints
            </a>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card-surface p-5 grid gap-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <span className="badge-brand">Fluxo</span>
            <span>Comece por aqui</span>
          </h2>
          <ul className="grid gap-2 text-sm">
            <li>
              • Planeje e acompanhe sprints em{" "}
              <a className="brand-link" href="/sprints">
                Sprints
              </a>
              .
            </li>
            <li>
              • Mova trabalho entre colunas no{" "}
              <a className="brand-link" href="/board">
                Board
              </a>
              .
            </li>
            <li>
              • Estime histórias em{" "}
              <a className="brand-link" href="/poker">
                Planning Poker
              </a>
              .
            </li>
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <a href="/projects" className="btn-primary h-9 px-4 text-sm">
              Ir para Projetos
            </a>
            <a
              href="/board"
              className="h-9 rounded-md border border-border px-4 text-sm hover:bg-[var(--brand-primary)]/10"
            >
              Board
            </a>
            <a
              href="/poker"
              className="h-9 rounded-md border border-border px-4 text-sm hover:bg-[var(--brand-primary)]/10"
            >
              Poker
            </a>
          </div>
        </div>

        <div className="card-surface p-5 grid gap-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <span className="badge-brand">Sessão</span>
            <span>{user ? "Status" : "Entrar"}</span>
          </h2>
          {!user ? (
            <div className="grid gap-3">
              <button
                onClick={() => signIn(undefined, { callbackUrl: "/projects" })}
                className="btn-primary h-9 px-4 text-sm"
              >
                Entrar
              </button>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Use seu provedor configurado para continuar.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="text-sm">
                Olá,{" "}
                <span className="font-semibold">{user.name || "Usuário"}</span>
                {user.email && (
                  <span className="text-[var(--muted-foreground)]">
                    {" "}
                    • {user.email}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <a href="/projects" className="btn-primary h-9 px-4 text-sm">
                  Projetos
                </a>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="h-9 rounded-md border border-border px-4 text-sm hover:bg-[var(--brand-primary)]/10"
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