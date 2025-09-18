"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type Project = { _id: string; name: string; key: string; ownerId: string; memberIds: string[]; createdAt: string };

const LS_SELECTED_PROJECT = "wm_selected_project_v1";
const allowSelfCreate = process.env.NEXT_PUBLIC_ALLOW_PROJECT_SELF_CREATE === "true";

// NEW: tipo para toast
type Notice = { id: string; type: "success" | "error" | "info"; msg: string };

export default function ProjectsPage() {
  const { data: session } = useSession();
  const meId = (session?.user as any)?.id as string | undefined;
  const isAdmin = Boolean((session?.user as any)?.admin);

  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // NEW: estados para pedido de admin e toasts
  const [requestReason, setRequestReason] = useState("");
  const [reqLoading, setReqLoading] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);

  const selectedProject = useMemo(
    () => items.find((p) => p._id === selected) || null,
    [items, selected]
  );
  const isOwner = !!(selectedProject && meId && selectedProject.ownerId === meId);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/projects", { cache: "no-store" });
    if (res.status === 401) {
      setItems([]);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject() {
    if (!name.trim() || !key.trim()) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), key: key.trim().toUpperCase() }),
    });
    if (res.ok) {
      setName("");
      setKey("");
      await load();
    }
  }

  async function addMember() {
    if (!selected || !email.trim()) return;
    const res = await fetch(`/api/projects/${selected}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    if (res.ok) {
      setEmail("");
      await load();
    }
  }

  async function removeMember(memberId: string) {
    if (!selected) return;
    const res = await fetch(`/api/projects/${selected}/members?memberId=${encodeURIComponent(memberId)}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
  }

  function openSprints(p: Project) {
    try {
      localStorage.setItem(LS_SELECTED_PROJECT, p._id);
      localStorage.setItem("wm_selected_project_name", p.name);
    } catch {
      /* ignore */
    }
    window.location.href = "/sprints";
  }

  function pushNotice(type: Notice["type"], msg: string, ttl = 4000) {
    const id = crypto.randomUUID();
    setNotices((n) => [...n, { id, type, msg }]);
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), ttl);
  }

  async function submitAdminRequest() {
    if (reqLoading) return;
    setReqLoading(true);
    try {
      const res = await fetch("/api/admin/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: requestReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        pushNotice(
          "success",
          data?.status === "pending"
            ? "Pedido enviado. Aguarde avaliação."
            : "Pedido registrado."
        );
        setRequestReason("");
      } else {
        pushNotice("error", data?.error || "Falha ao enviar pedido");
      }
    } finally {
      setReqLoading(false);
    }
  }

  return (
    <section className="grid gap-6">
      {/* NEW: container de toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {notices.map((n) => (
          <div
            key={n.id}
            className={`rounded-md px-3 py-2 text-xs shadow border ${
              n.type === "success"
                ? "bg-green-500/10 border-green-500/30 text-green-700"
                : n.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-600"
                : "bg-foreground/10 border-foreground/30 text-foreground/80"
            }`}
          >
            {n.msg}
          </div>
        ))}
      </div>

      <header>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <span>Projetos</span>
        </h1>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {isAdmin
            ? "Você é admin. Pode criar projetos e gerenciar membros."
            : "Você só vê projetos dos quais é membro."}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-surface p-4">
          <h2 className="mb-2 text-sm font-semibold flex items-center gap-2">
            <span className="badge-brand">Lista</span>
            <span>Meus projetos</span>
          </h2>
          {loading ? (
            <div className="text-xs text-[var(--muted-foreground)]">Carregando...</div>
          ) : (
            <ul className="grid gap-2">
              {items.map((p) => (
                <li
                  key={p._id}
                  className={`relative rounded-md border border-foreground/10 bg-background/60 p-3 transition 
                    ${selected === p._id ? "ring-2 ring-[var(--brand-primary)] shadow-brand" : "hover:border-[var(--brand-primary)]/40"}`}
                >
                  <div className="absolute inset-x-0 top-0 h-1 rounded-t-md bg-gradient-to-r from-[#FF7C1A] to-[#ff9d59] opacity-70" />
                  <div className="flex items-center justify-between gap-2">
                    <div onClick={() => setSelected(p._id)} className="min-w-0 cursor-pointer flex flex-col gap-2">
                      <div className="text-[10px] tracking-wide font-medium text-[var(--brand-secondary)]">{p.key}</div>
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">
                        Membros: {p.memberIds.length}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setSelected(p._id)}
                        className="h-7 rounded-md border border-foreground/15 px-2 text-[10px] hover:bg-[var(--brand-primary)]/10"
                      >
                        Selecionar
                      </button>
                      <button
                        onClick={() => openSprints(p)}
                        className="h-7 rounded-md border border-foreground/15 px-2 text-[10px] hover:bg-[var(--brand-primary)]/10"
                      >
                        Sprints
                      </button>
                      {(isAdmin || p.ownerId === meId) && (
                        <a
                          href={`/projects/${p._id}/settings`}
                          className="h-7 rounded-md border border-foreground/15 px-2 text-[10px] hover:bg-[var(--brand-primary)]/10  flex items-center justify-center"
                        >
                          Config
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
              {items.length === 0 && (
                <li className="text-xs text-[var(--muted-foreground)]">
                  Nenhum projeto. Crie um ao lado.
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="card-surface p-4">
          <h2 className="mb-2 text-sm font-semibold flex items-center gap-2">
            <span className="badge-brand">Novo</span>
            <span>Criar projeto</span>
          </h2>
          {!(allowSelfCreate || isAdmin) ? (
            <div className="text-xs text-[var(--muted-foreground)]">
              Criação desabilitada. Peça a um admin.
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome"
                  className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                />
                <input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="SIGLA"
                  className="h-9 w-36 rounded-md border border-border bg-background px-3 text-sm uppercase focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                />
                <button
                  onClick={createProject}
                  className="btn-primary h-9 px-4 text-sm"
                >
                  Criar
                </button>
              </div>

              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold">Membros</h3>
                {!selected ? (
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Selecione um projeto.
                  </div>
                ) : isOwner ? (
                  <div className="grid gap-2">
                    <div className="flex gap-2">
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@empresa.com"
                        className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                      />
                      <button
                        onClick={addMember}
                        className="h-9 rounded-md border border-foreground/20 px-3 text-sm hover:bg-[var(--brand-primary)]/10"
                      >
                        Adicionar
                      </button>
                    </div>
                    <div className="text-[10px] text-[var(--muted-foreground)]">
                      Remoção apenas pelo dono.
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Apenas o dono gerencia membros.
                  </div>
                )}
              </div>
            </>
          )}

          {!isAdmin && (
            <div className="mt-8 rounded-md border border-border p-3 bg-background/40">
              <h3 className="mb-2 text-sm font-semibold flex items-center gap-2">
                <span className="badge-brand">Permissão</span>
                <span>Solicitar admin</span>
              </h3>
              <p className="text-[11px] text-foreground/60 mb-2">
                Admins podem criar projetos e gerenciar usuários. Descreva por que precisa dessa permissão.
              </p>
              <textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Motivo (opcional, até 500 caracteres)"
                maxLength={500}
                className="min-h-24 w-full resize-none rounded-md border border-foreground/20 bg-background p-2 text-xs"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  onClick={submitAdminRequest}
                  disabled={reqLoading}
                  className="h-8 rounded-md bg-foreground px-3 text-background text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {reqLoading ? "Enviando..." : "Enviar pedido"}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-foreground/50">
                Você será notificado pelos administradores (fora da plataforma) quando aprovado.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}