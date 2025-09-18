"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";

type Member = { _id: string; email?: string; name?: string };
type Project = { _id: string; name: string; key: string; ownerId: string; memberIds: string[]; createdAt: string };

type Notice = { id: string; type: "success" | "error" | "info"; msg: string };

export default function ProjectSettings() {
  const params = useParams();
  const projectId = (params as any)?.id?.toString();

  const { data: session } = useSession();
  const meId = (session?.user as any)?.id;
  const isAdmin = Boolean((session?.user as any)?.admin);

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [rename, setRename] = useState("");
  const [busy, setBusy] = useState(false);

  const [notices, setNotices] = useState<Notice[]>([]);
  function push(type: Notice["type"], msg: string, ttl = 4000) {
    const id = crypto.randomUUID();
    setNotices((n) => [...n, { id, type, msg }]);
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), ttl);
  }

  const isOwner = project && project.ownerId === meId;

  const ownerName =
    project
      ? (
          members.find((m) => m._id === project.ownerId)?.name ||
          members.find((m) => m._id === project.ownerId)?.email ||
          project.ownerId
        )
      : "";

  useEffect(() => {
    if (!projectId) return;
    load();
  }, [projectId]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}?includeMembers=1`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setProject(data.project || data);
      setMembers(data.members || []);
      setRename((data.project || data).name);
    } else {
      push("error", "Falha ao carregar projeto");
    }
    setLoading(false);
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim().toLowerCase() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      push("success", data.invited ? "Convite enviado" : "Membro adicionado");
      setInviteEmail("");
      await load();
    } else {
      push("error", data?.error || "Erro ao convidar");
    }
    setBusy(false);
  }

  // NOVOS estados para modais de confirmação
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  async function removeMember(id: string) {
    // SUBSTITUI: antes usava confirm(); agora apenas abre modal
    const m = members.find((mm) => mm._id === id) || { _id: id };
    setMemberToRemove(m);
  }

  async function finalizeRemoveMember() {
    // NEW
    if (!projectId || !memberToRemove) return;
    setRemovingMember(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members?memberId=${encodeURIComponent(memberToRemove._id)}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        push("success", "Membro removido");
        await load();
      } else {
        push("error", "Erro ao remover membro");
      }
    } catch {
      push("error", "Falha de rede");
    } finally {
      setRemovingMember(false);
      setMemberToRemove(null);
    }
  }

  async function deleteProject() {
    // SUBSTITUI: antes confirm(); agora abre modal
    setConfirmDeleteProject(true);
  }

  async function finalizeDeleteProject() {
    // NEW
    if (!projectId) return;
    setDeletingProject(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        push("success", "Projeto removido");
        setTimeout(() => {
          window.location.href = "/projects";
        }, 900);
      } else {
        push("error", "Falha ao remover");
        setDeletingProject(false);
      }
    } catch {
      push("error", "Erro de rede");
      setDeletingProject(false);
    }
  }

  async function renameProject() {
    if (!rename.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: rename.trim() }),
    });
    if (res.ok) {
      push("success", "Nome atualizado");
      await load();
    } else {
      push("error", "Erro ao atualizar nome");
    }
    setBusy(false);
  }

  const canManage = isAdmin || isOwner;

  if (!loading && !project) {
    return (
      <section className="grid place-items-center py-16">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Projeto não encontrado</h2>
          <a href="/projects" className="mt-2 inline-block text-sm underline">
            Voltar
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-8">
      {/* Toasts */}
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

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Configurações do Projeto {project ? "• " + project.key : ""}
          </h1>
          <p className="text-xs text-foreground/60">
            Gerencie membros, nome e exclusão. {canManage ? "" : "Você não tem permissão de edição."}
          </p>
        </div>
        <a
          href="/projects"
          className="text-xs underline"
        >
          Voltar
        </a>
      </header>

      {/* Nome */}
      <div className="rounded-lg border border-foreground/10 p-4">
        <h2 className="mb-3 text-sm font-semibold">Informações</h2>
        {loading ? (
          <div className="text-xs text-foreground/60">Carregando...</div>
        ) : (
          <div className="grid gap-3 max-w-md">
            <label className="grid gap-1 text-xs">
              <span>Nome do projeto</span>
              <input
                value={rename}
                disabled={!canManage || busy}
                onChange={(e) => setRename(e.target.value)}
                className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
              />
            </label>
            <button
              onClick={renameProject}
              disabled={!canManage || busy}
              className="h-9 w-fit rounded-md bg-foreground px-3 text-background text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              Salvar
            </button>
            <div className="text-[11px] text-foreground/60">
              ID: {project?._id} • Dono: {ownerName}
            </div>
          </div>
        )}
      </div>

      {/* Membros */}
      <div className="rounded-lg border border-foreground/10 p-4">
        <h2 className="mb-3 text-sm font-semibold">Membros</h2>
        {loading ? (
          <div className="text-xs text-foreground/60">Carregando...</div>
        ) : (
          <div className="grid gap-4">
            <ul className="grid gap-2">
              {members.map((m) => (
                <li
                  key={m._id}
                  className="flex items-center justify-between rounded-md border border-foreground/10 bg-background px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{m.name || "(sem nome)"}</div>
                    <div className="text-foreground/60">{m.email || "—"}</div>
                  </div>
                  {canManage && m._id !== project?.ownerId && (
                    <button
                      onClick={() => removeMember(m._id)} // UPDATED
                      disabled={busy}
                      className="rounded-md border border-foreground/20 px-2 py-1 text-[10px] hover:bg-foreground/5 disabled:opacity-40"
                    >
                      Remover
                    </button>
                  )}
                </li>
              ))}
              {!members.length && (
                <li className="text-xs text-foreground/60">Sem membros.</li>
              )}
            </ul>

            {canManage && (
              <div className="flex gap-2">
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@empresa.com"
                  disabled={busy}
                  className="h-9 flex-1 rounded-md border border-foreground/20 bg-background px-3 text-sm"
                />
                <button
                  onClick={sendInvite}
                  disabled={busy || !inviteEmail.trim()}
                  className="h-9 rounded-md border border-foreground/20 px-3 text-sm hover:bg-foreground/5 disabled:opacity-40"
                >
                  Convidar
                </button>
              </div>
            )}
            {!canManage && (
              <div className="text-[11px] text-foreground/60">
                Apenas admins ou o dono podem gerenciar membros.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Exclusão */}
      <div className="rounded-lg border border-foreground/10 p-4">
        <h2 className="mb-3 text-sm font-semibold text-red-600">Zona de Perigo</h2>
        <p className="text-[11px] text-foreground/60 mb-3">
          Excluir o projeto remove sprints e histórias associadas. A ação não pode ser desfeita.
        </p>
        <button
          onClick={deleteProject} // UPDATED
          disabled={!canManage || busy}
          className="h-9 rounded-md bg-red-600 px-3 text-background text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          Excluir projeto
        </button>
      </div>

      {/* MODAL REMOVER MEMBRO (NEW) */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-foreground/20 bg-background p-6 grid gap-5 text-sm">
            <h3 className="text-sm font-semibold">Remover membro</h3>
            <div className="text-[11px] text-foreground/70 leading-relaxed space-y-2">
              <p>
                Tem certeza que deseja remover{" "}
                <strong>{memberToRemove.name || memberToRemove.email || memberToRemove._id}</strong> do projeto?
              </p>
              <p className="text-foreground/60">
                Essa pessoa perderá acesso às sprints, board e backlog deste projeto.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMemberToRemove(null)}
                disabled={removingMember}
                className="h-8 rounded-md border border-foreground/20 px-3 text-xs hover:bg-foreground/5 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={finalizeRemoveMember}
                disabled={removingMember}
                className="h-8 rounded-md bg-red-600 px-3 text-background text-xs font-medium hover:opacity-90 disabled:opacity-40"
              >
                {removingMember ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR PROJETO (NEW) */}
      {confirmDeleteProject && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-red-500/30 bg-background p-6 grid gap-5 text-sm">
            <h3 className="text-sm font-semibold text-red-600">Excluir Projeto</h3>
            <div className="text-[11px] text-foreground/70 leading-relaxed space-y-3">
              <p>
                Esta ação irá remover permanentemente o projeto{" "}
                <strong>{project?.name}</strong> e todos os seus dados
                (sprints, histórias, configurações).
              </p>
              <p className="text-foreground/60">
                Não há como desfazer. Confirme se tem certeza.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteProject(false)}
                disabled={deletingProject}
                className="h-8 rounded-md border border-foreground/20 px-3 text-xs hover:bg-foreground/5 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={finalizeDeleteProject}
                disabled={deletingProject}
                className="h-8 rounded-md bg-red-600 px-3 text-background text-xs font-medium hover:opacity-90 disabled:opacity-40"
              >
                {deletingProject ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
