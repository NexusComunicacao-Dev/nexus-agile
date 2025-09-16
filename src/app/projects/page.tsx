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
        <h1 className="text-2xl font-semibold">Projetos</h1>
        <p className="text-xs text-foreground/60">
          {isAdmin ? "Você é admin. Pode criar projetos e gerenciar membros." : "Você só vê projetos dos quais é membro. Criação pode estar limitada a admins."}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-foreground/10 p-4">
          <h2 className="mb-2 text-sm font-semibold">Meus projetos</h2>
          {loading ? (
            <div className="text-xs text-foreground/60">Carregando...</div>
          ) : (
            <ul className="grid gap-2">
              {items.map((p) => (
                <li key={p._id} className={`rounded-md border border-foreground/10 bg-background p-3 ${selected === p._id ? "ring-1 ring-foreground/30" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div onClick={() => setSelected(p._id)} className="min-w-0 cursor-pointer">
                      <div className="text-xs text-foreground/60">{p.key}</div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-[10px] text-foreground/60">Membros: {p.memberIds.length}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setSelected(p._id)} className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5">
                        Selecionar
                      </button>
                      <button onClick={() => openSprints(p)} className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5">
                        Abrir Sprints
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {items.length === 0 && (
                <li className="text-xs text-foreground/60">
                  Nenhum projeto. Crie um projeto ao lado para começar e então abra as sprints.
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-foreground/10 p-4">
          <h2 className="mb-2 text-sm font-semibold">Criar projeto</h2>
          {!(allowSelfCreate || isAdmin) ? (
            <div className="text-xs text-foreground/60">
              A criação de projetos está desabilitada. Peça a um administrador para criar e convidá-lo.
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="h-9 flex-1 rounded-md border border-foreground/20 bg-background px-3 text-sm" />
                <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="SIGLA (ex.: NX)" className="h-9 w-36 rounded-md border border-foreground/20 bg-background px-3 text-sm uppercase" />
                <button onClick={createProject} className="h-9 rounded-md bg-foreground px-3 text-background text-sm font-medium hover:opacity-90">
                  Criar
                </button>
              </div>

              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold">Membros</h3>
                {!selected ? (
                  <div className="text-xs text-foreground/60">Selecione um projeto para gerenciar membros.</div>
                ) : isOwner ? (
                  <div className="grid gap-2">
                    <div className="flex gap-2">
                      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" className="h-9 flex-1 rounded-md border border-foreground/20 bg-background px-3 text-sm" />
                      <button onClick={addMember} className="h-9 rounded-md border border-foreground/20 px-3 text-sm hover:bg-foreground/5">
                        Adicionar
                      </button>
                    </div>
                    <div className="text-[11px] text-foreground/60">A remoção também é só pelo dono (via memberId por enquanto).</div>
                  </div>
                ) : (
                  <div className="text-xs text-foreground/60">Apenas o dono do projeto pode gerenciar membros.</div>
                )}
              </div>
            </>
          )}

          {/* NEW: painel de pedido de admin (apenas não-admin) */}
          {!isAdmin && (
            <div className="mt-8 rounded-md border border-foreground/10 p-3">
              <h3 className="mb-2 text-sm font-semibold">Solicitar acesso de admin</h3>
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