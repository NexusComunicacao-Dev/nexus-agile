"use client";

import { useEffect, useState } from "react";

type User = { name: string; email?: string };
const LS_USER = "wm_user_v1";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_USER);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  function login(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const u: User = { name: name.trim(), email: email.trim() || undefined };
    try {
      localStorage.setItem(LS_USER, JSON.stringify(u));
    } catch {
      /* ignore */
    }
    setUser(u);
  }

  function logout() {
    try {
      localStorage.removeItem(LS_USER);
    } catch {
      /* ignore */
    }
    setUser(null);
    setName("");
    setEmail("");
  }

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
              <a
                className="underline hover:opacity-80"
                href="/sprints"
              >
                Sprints
              </a>
              .
            </li>
            <li>
              • Arraste histórias entre colunas no{" "}
              <a
                className="underline hover:opacity-80"
                href="/board"
              >
                Kanban
              </a>
              .
            </li>
            <li>
              • Estime histórias com{" "}
              <a
                className="underline hover:opacity-80"
                href="/poker"
              >
                Planning Poker
              </a>
              .
            </li>
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/sprints"
              className="rounded-md bg-foreground px-4 py-2 text-background text-sm font-medium hover:opacity-90"
            >
              Ir para Sprints
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
            {user ? "Sessão" : "Entrar (mock)"}
          </h2>
          {!user ? (
            <form onSubmit={login} className="grid gap-3">
              <label className="grid gap-1 text-xs">
                <span>Nome</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
                  placeholder="Seu nome"
                />
              </label>
              <label className="grid gap-1 text-xs">
                <span>Email (opcional)</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
                  placeholder="voce@empresa.com"
                />
              </label>
              <button
                type="submit"
                className="h-9 rounded-md bg-foreground px-3 text-background text-sm font-medium hover:opacity-90"
              >
                Entrar
              </button>
              <p className="text-[11px] text-foreground/60">
                Dica: isso é um login local para testes. Em produção, use Auth.js.
              </p>
            </form>
          ) : (
            <div className="grid gap-3">
              <div className="text-sm">
                Olá,{" "}
                <span className="font-semibold">{user.name}</span>
                {user.email ? (
                  <span className="text-foreground/60"> • {user.email}</span>
                ) : null}
              </div>
              <div className="flex gap-2">
                <a
                  href="/sprints"
                  className="rounded-md bg-foreground px-3 py-2 text-background text-sm font-medium hover:opacity-90"
                >
                  Ir para Sprints
                </a>
                <button
                  onClick={logout}
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
