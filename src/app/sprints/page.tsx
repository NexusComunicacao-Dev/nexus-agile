"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

// Tipos locais (simplificados)
type Status = "todo" | "doing" | "testing" | "awaiting deploy" | "deployed" | "done"; // UPDATED
interface Story {
  _id: string;
  title: string;
  status: Status;
  points?: number;
  priority?: string;
  createdAt: string;
  sprintId?: string;
  description?: string; // NOVO: campo de descrição
  comments?: { _id: string; userId: string; text: string; createdAt: string }[]; // NEW
  assigneeId?: string | null; // NEW
}
interface Sprint {
  _id: string;
  name: string;
  goal?: string;
  status: "active" | "completed";
  createdAt: string;
  completedAt?: string;
  projectId: string;
}
type Member = { id: string; name: string; email?: string; initials: string }; // NEW

const LS_SELECTED_PROJECT = "wm_selected_project_v1";

export default function SprintsPage() {
  const { data: session } = useSession();
  const isAdmin = Boolean((session?.user as any)?.admin);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Sprint | null>(null);
  const [activeStories, setActiveStories] = useState<Story[]>([]);
  const [backlog, setBacklog] = useState<Story[]>([]);
  const [history, setHistory] = useState<Sprint[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Modais
  const [creatingSprint, setCreatingSprint] = useState(false);
  const [creatingStory, setCreatingStory] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [newSprintName, setNewSprintName] = useState("");
  const [newSprintGoal, setNewSprintGoal] = useState("");
  const [newStoryTitle, setNewStoryTitle] = useState("");
  const [storyPoints, setStoryPoints] = useState<string>("");
  const [storyStatus, setStoryStatus] = useState<Status>("todo");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState(""); 
  // Estado para edição da descrição
  const [editingDescription, setEditingDescription] = useState<string>(""); // FIXED
  // NEW estados para detalhes completos, comentários
  const [editingFull, setEditingFull] = useState<Story | null>(null);
  const [commentText, setCommentText] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  // Adição: estados de filtro
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [minPts, setMinPts] = useState<string>("");
  const [maxPts, setMaxPts] = useState<string>("");

  // NOTIFICAÇÕES (snackbar)
  type Notice = { id: string; type: "success" | "error" | "info"; msg: string };
  const [notices, setNotices] = useState<Notice[]>([]); // NEW
  function pushNotice(type: Notice["type"], msg: string, ttl = 3500) { // NEW
    const id = crypto.randomUUID();
    setNotices(n => [...n, { id, type, msg }]);
    setTimeout(() => setNotices(n => n.filter(x => x.id !== id)), ttl);
  }

  // Confirmação de exclusão
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null); // NEW
  const [deleting, setDeleting] = useState(false); // NEW

  // NEW: estados para membros e responsáveis
  const [members, setMembers] = useState<Member[]>([]); // NEW
  const [assigneeNew, setAssigneeNew] = useState<string>(""); // NEW (criação)
  const [assigneeEdit, setAssigneeEdit] = useState<string>(""); // NEW (edição)

  useEffect(() => {
    try {
      const pid = localStorage.getItem(LS_SELECTED_PROJECT);
      const pname = localStorage.getItem("wm_selected_project_name");
      setProjectId(pid);
      setProjectName(pname);
    } catch {
      /* ignore */
    }
  }, []);

  async function loadAll(pid: string) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/projects/${pid}/sprints?active=1`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setError("Falha ao carregar sprints");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setActive(data.activeSprint || null);
    setActiveStories(data.activeStories || []);
    setBacklog(data.backlog || []);
    setHistory(data.history || []);
    setLoading(false);
  }

  useEffect(() => {
    if (projectId) loadAll(projectId);
  }, [projectId]);

  // NEW: carregar membros do projeto
  useEffect(() => {
    async function loadMembers() {
      if (!projectId) return;
      try {
        const r = await fetch(`/api/projects/${projectId}/members`, { cache: "no-store" });
        if (r.ok) {
          const js = await r.json();
          setMembers(js.members || []); // ensure state exists
        }
      } catch {
        // ignore
      }
    }
    loadMembers();
  }, [projectId]); // NEW efeito (caso ainda não exista)

  async function createSprint() {
    if (!projectId || !isAdmin) return;
    if (!newSprintName.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/sprints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newSprintName.trim(),
        goal: newSprintGoal.trim() || undefined,
        startDate: new Date().toISOString(),
      }),
    });
    if (res.ok) {
      setNewSprintName("");
      setNewSprintGoal("");
      setCreatingSprint(false);
      await loadAll(projectId);
    }
  }

  async function finishSprint() {
    if (!active || !isAdmin) return;
    const res = await fetch(`/api/sprints/${active._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok && projectId) await loadAll(projectId);
  }

  async function createStory() {
    if (!projectId) return;
    if (!newStoryTitle.trim()) return;
    const res = await fetch(`/api/sprints/backlog/stories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        title: newStoryTitle.trim(),
        projectId,
        description: newDescription.trim() || undefined,
        assigneeId: assigneeNew || undefined // NEW
      }),
    });
    if (res.ok) {
      setNewStoryTitle("");
      setNewDescription(""); // NEW
      setAssigneeNew(""); // NEW
      setCreatingStory(false);
      await loadAll(projectId);
    }
  }

  async function moveToSprint(story: Story) {
    if (!active || !projectId) return;
    const res = await fetch(`/api/stories/${story._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sprintId: active._id }),
    });
    if (res.ok) await loadAll(projectId!);
  }

  async function moveToBacklog(story: Story) {
    if (!projectId) return;
    const res = await fetch(`/api/stories/${story._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sprintId: null }),
    });
    if (res.ok) await loadAll(projectId!);
  }

  function openEdit(story: Story) {
    setEditingStory(story);
    setStoryPoints(story.points != null ? String(story.points) : "");
    setStoryStatus(story.status as Status);
    setEditingDescription(story.description || "");
    setAssigneeEdit(story.assigneeId || "");
    fetchStoryDetails(story._id); // NEW
  }

  async function fetchStoryDetails(id: string) { // NEW
    try {
      const r = await fetch(`/api/stories/${id}`, { cache: "no-store" });
      if (r.ok) {
        const full = await r.json();
        setEditingFull(full);
        // garantir sync caso tenha mudado no servidor
        setStoryStatus(full.status);
        setEditingDescription(full.description || "");
        setStoryPoints(full.points != null ? String(full.points) : "");
      }
    } catch {
      /* ignore */
    }
  }

  async function saveStoryEdits() {
    if (!editingStory || !projectId) return;
    const res = await fetch(`/api/stories/${editingStory._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        points: storyPoints ? Number(storyPoints) : undefined,
        status: storyStatus,
        description: editingDescription.trim() || undefined,
        assigneeId: assigneeEdit || null, // NEW
      }),
    });
    if (res.ok) {
      setEditingStory(null);
      setEditingFull(null); // NEW
      await loadAll(projectId);
    }
  }

  async function addComment() { // NEW
    if (!editingStory || !commentText.trim()) return;
    setAddingComment(true);
    try {
      const r = await fetch(`/api/stories/${editingStory._id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: commentText.trim() }),
      });
      if (r.ok) {
        const js = await r.json();
        setEditingFull(f => f ? { ...f, comments: js.comments } : f);
        setCommentText("");
      }
    } finally {
      setAddingComment(false);
    }
  }

  // Função helper para aplicar filtros
  function matchFilters(story: Story) {
    if (filterPriority !== "all" && story.priority && story.priority !== filterPriority)
      return false;
    const min = minPts ? Number(minPts) : null;
    const max = maxPts ? Number(maxPts) : null;
    if (min !== null || max !== null) {
      if (story.points == null) return false; // se filtrando por pontos, exigir pontos definidos
      if (min !== null && story.points < min) return false;
      if (max !== null && story.points > max) return false;
    }
    return true;
  }

  const filteredBacklog = useMemo(
    () => backlog.filter(matchFilters),
    [backlog, filterPriority, minPts, maxPts]
  );
  const filteredActiveStories = useMemo(
    () => activeStories.filter(matchFilters),
    [activeStories, filterPriority, minPts, maxPts]
  );

  const doneCount = useMemo(
    () => filteredActiveStories.filter((s) => s.status === "done").length,
    [filteredActiveStories]
  );

  if (!projectId) {
    return (
      <section className="grid place-items-center gap-4 py-16">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Selecione um projeto</h2>
          <p className="mt-1 text-sm text-foreground/60">
            As sprints existem dentro de um projeto. Vá para "Projetos" e crie/abra
            um projeto.
          </p>
          <a
            href="/projects"
            className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-background text-sm font-medium hover:opacity-90"
          >
            Ir para Projetos
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-8">
      {/* SNACKBAR */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {notices.map(n => (
          <div
            key={n.id}
            className={`rounded-md px-3 py-2 text-xs shadow border ${
              n.type === "success"
                ? "bg-green-500/15 border-green-500/30 text-green-700"
                : n.type === "error"
                ? "bg-red-500/15 border-red-500/30 text-red-600"
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
            Sprints {projectName ? `• ${projectName}` : ""}
          </h1>
          <p className="text-xs text-foreground/60">
            Gerencie backlog e sprints do projeto.{" "}
            {!isAdmin && "(Apenas admins podem iniciar/finalizar sprints)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!active ? (
            <button
              onClick={() => isAdmin && setCreatingSprint(true)}
              disabled={!isAdmin}
              className="h-9 rounded-md bg-foreground px-3 text-background text-sm font-medium hover:opacity-90 disabled:opacity-40"
              title={!isAdmin ? "Apenas admin" : ""}
            >
              Iniciar sprint
            </button>
          ) : (
            <button
              onClick={finishSprint}
              disabled={!isAdmin}
              className="h-9 rounded-md border border-foreground/20 px-3 text-sm hover:bg-foreground/5 disabled:opacity-40"
              title={!isAdmin ? "Apenas admin" : ""}
            >
              Finalizar sprint
            </button>
          )}
          <button
            onClick={() => setCreatingStory(true)}
            className="h-9 rounded-md border border-foreground/20 px-3 text-sm hover:bg-foreground/5"
          >
            Nova história
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-foreground/10 bg-background/50 p-3 text-[11px]">
        <div className="flex flex-col gap-1">
          <label className="font-medium">Prioridade</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="h-8 rounded-md border border-foreground/20 bg-background px-2 text-xs"
          >
            <option value="all">Todas</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium">Pontos mín.</label>
          <input
            value={minPts}
            onChange={(e) => setMinPts(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder=""
            className="h-8 w-20 rounded-md border border-foreground/20 bg-background px-2 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium">Pontos máx.</label>
          <input
            value={maxPts}
            onChange={(e) => setMaxPts(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder=""
            className="h-8 w-20 rounded-md border border-foreground/20 bg-background px-2 text-xs"
          />
        </div>
        <div className="flex flex-col justify-end">
          <button
            onClick={() => { setFilterPriority("all"); setMinPts(""); setMaxPts(""); }}
            className="h-8 rounded-md border border-foreground/20 px-3 text-xs hover:bg-foreground/5"
          >
            Limpar
          </button>
        </div>
        <div className="ml-auto flex items-end text-[10px] text-foreground/50 italic">
          {filteredBacklog.length} backlog / {filteredActiveStories.length} sprint
        </div>
      </div>

      {loading && (
        <div className="text-xs text-foreground/60">Carregando...</div>
      )}
      {error && <div className="text-xs text-red-600">{error}</div>}

      {/* Backlog (filtrado) */}
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Backlog ({filteredBacklog.length})</h2>
        <ul className="grid gap-2">
          {filteredBacklog.map((st) => (
            <li
              key={st._id}
              className="rounded-md border border-foreground/10 bg-background p-3 text-xs flex gap-3"
            >
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => openEdit(st)}
              >
                <div className="font-medium truncate flex items-center gap-2">
                  <span className="truncate">{st.title}</span>
                  {st.points != null && (
                    <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] text-foreground/70">
                      {st.points} pts
                    </span>
                  )}
                  {st.assigneeId && (
                    <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-semibold">
                      {members.find(m=>m.id===st.assigneeId)?.initials || "?"}
                    </span>
                  )}
                </div>
                {st.description && (
                  <div className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[10px] text-foreground/60">
                    {st.description}
                  </div>
                )}
              </div>
              {active && (
                <button
                  onClick={() => moveToSprint(st)}
                  className="self-start rounded-md border border-foreground/20 px-2 py-1 text-[10px] hover:bg-foreground/5"
                >
                  + Sprint
                </button>
              )}
            </li>
          ))}
          {filteredBacklog.length === 0 && (
            <li className="text-[11px] text-foreground/60">
              Nenhuma história corresponde aos filtros.
            </li>
          )}
        </ul>
      </section>

      {/* Active sprint (filtrada) */}
      {active && (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold">Sprint ativa • {active.name}</h2>
          <p className="text-[11px] text-foreground/60">
            Concluídas: {doneCount}/{filteredActiveStories.length}
          </p>
          <ul className="grid gap-2">
            {filteredActiveStories.map((st) => (
              <li
                key={st._id}
                className="rounded-md border border-foreground/10 bg-background p-3 text-xs flex items-center justify-between gap-3"
              >
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => openEdit(st)}
                >
                  <div className="font-medium truncate flex items-center gap-2">
                    <span className="truncate">{st.title}</span>
                    {st.assigneeId && (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 text-[9px] font-semibold">
                        {members.find(m=>m.id===st.assigneeId)?.initials || "?"}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-foreground/50">
                    Status: {st.status}
                    {st.points != null ? ` • ${st.points} pts` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  {st.status !== "done" && (
                    <button
                      onClick={() => saveStatusQuick(st, "doing")}
                      className="rounded-md border border-foreground/20 px-2 py-1 text-[10px] hover:bg-foreground/5"
                    >
                      Doing
                    </button>
                  )}
                  {st.status !== "done" && (
                    <button
                      onClick={() => saveStatusQuick(st, "done")}
                      className="rounded-md border border-foreground/20 px-2 py-1 text-[10px] hover:bg-foreground/5"
                    >
                      Done
                    </button>
                  )}
                  <button
                    onClick={() => moveToBacklog(st)}
                    className="rounded-md border border-foreground/20 px-2 py-1 text-[10px] hover:bg-foreground/5"
                    title="Mover para backlog"
                  >
                    ←
                  </button>
                </div>
              </li>
            ))}
            {filteredActiveStories.length === 0 && (
              <li className="text-[11px] text-foreground/60">
                Nenhuma história na sprint corresponde aos filtros.
              </li>
            )}
          </ul>
        </section>
      )}

      {/* History */}
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Histórico</h2>
        <ul className="grid gap-2">
          {history.map((sp) => (
            <li
              key={sp._id}
              className="rounded-md border border-foreground/10 bg-background p-3 text-xs flex items-center justify-between hover:bg-foreground/5 transition cursor-pointer"
              onClick={() => (window.location.href = `/sprints/${sp._id}`)}
              title="Ver detalhes da sprint"
            >
              <span className="truncate font-medium">{sp.name}</span>
              <span className="text-[10px] text-foreground/50">
                {sp.completedAt
                  ? new Date(sp.completedAt).toLocaleDateString()
                  : ""}
              </span>
            </li>
          ))}
          {history.length === 0 && (
            <li className="text-[11px] text-foreground/60">
              Sem sprints finalizadas.
            </li>
          )}
        </ul>
      </section>

      {/* Modal criar sprint */}
      {creatingSprint && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-foreground/20 bg-background p-6 grid gap-4 text-sm">
            <h3 className="font-semibold text-sm">Nova Sprint</h3>
            <input
              value={newSprintName}
              onChange={(e) => setNewSprintName(e.target.value)}
              placeholder="Nome"
              className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
            />
            <textarea
              value={newSprintGoal}
              onChange={(e) => setNewSprintGoal(e.target.value)}
              placeholder="Meta (opcional)"
              className="min-h-20 rounded-md border border-foreground/20 bg-background p-2 text-sm"
            />
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => setCreatingSprint(false)}
                className="h-8 rounded-md border border-foreground/20 px-3 text-xs hover:bg-foreground/5"
              >
                Cancelar
              </button>
              <button
                onClick={createSprint}
                disabled={!newSprintName.trim()}
                className="h-8 rounded-md bg-foreground px-3 text-background text-xs font-medium disabled:opacity-40"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal criar história */}
      {creatingStory && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-foreground/20 bg-background p-6 grid gap-4 text-sm">
            <h3 className="font-semibold text-sm">Nova História (Backlog)</h3>
            <input
              value={newStoryTitle}
              onChange={(e) => setNewStoryTitle(e.target.value)}
              placeholder="Título"
              className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
            />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={3}
              className="rounded-md border border-foreground/20 bg-background px-3 py-2 text-xs resize-y"
            />
            {/* Novo: seleção de responsável */}
            <div className="grid gap-2">
              <label className="font-medium text-[10px]">Responsável</label>
              {members.length === 0 && (
                <div className="text-[10px] text-foreground/50">
                  Carregando membros ou nenhum membro no projeto.
                </div>
              )}
              <select
                value={assigneeNew}
                onChange={(e)=>setAssigneeNew(e.target.value)}
                className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-xs"
              >
                <option value="">Sem responsável</option>
                {members.map(m=>(
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => setCreatingStory(false)}
                className="h-8 rounded-md border border-foreground/20 px-3 text-xs hover:bg-foreground/5"
              >
                Cancelar
              </button>
              <button
                onClick={createStory}
                disabled={!newStoryTitle.trim()}
                className="h-8 rounded-md bg-foreground px-3 text-background text-xs font-medium disabled:opacity-40"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar história */}
      {editingStory && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-foreground/20 bg-background p-6 grid gap-5 text-sm">
            <h3 className="font-semibold text-sm">Editar História</h3>
            <div className="grid gap-4 max-h-[70vh] overflow-auto pr-1">
              <div className="text-xs font-medium break-words flex items-center gap-2">
                <span className="truncate">{editingFull?.title || editingStory.title}</span>
                {editingFull?.assigneeId && (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-semibold">
                    {members.find(m=>m.id===editingFull.assigneeId)?.initials || "?"}
                  </span>
                )}
              </div>
              <label className="grid gap-2 text-[10px]">
                Descrição
                <textarea
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  rows={4}
                  className="rounded-md border border-foreground/20 bg-background p-2 text-[11px] resize-y"
                  placeholder="Descrição"
                />
              </label>
              <div className="flex gap-3">
                <label className="grid gap-2 text-[10px] flex-1">
                  Pontos
                  <input
                    value={storyPoints}
                    onChange={(e) => setStoryPoints(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="ex.: 5"
                    className="h-8 rounded-md border border-foreground/20 bg-background px-2 text-xs"
                  />
                </label>
                <label className="grid gap-2 text-[10px] flex-1">
                  Status
                  <select
                    value={storyStatus}
                    onChange={(e) => setStoryStatus(e.target.value as Status)}
                    className="h-8 rounded-md border border-foreground/20 bg-background px-2 text-xs"
                  >
                    {["todo","doing","testing","awaiting deploy","deployed","done"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              {/* Novo: seleção de responsável (edição) */}
              <label className="grid gap-2 text-[10px]">
                Responsável
                <select
                  value={assigneeEdit}
                  onChange={(e)=>setAssigneeEdit(e.target.value)}
                  className="h-8 rounded-md border border-foreground/20 bg-background px-2 text-xs"
                >
                  <option value="">Sem responsável</option>
                  {members.map(m=>(
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {members.length === 0 && (
                  <span className="text-[9px] text-foreground/50">
                    Nenhum membro carregado.
                  </span>
                )}
              </label>
              <div className="grid gap-2 text-[10px]">
                <span className="font-medium">Comentários</span>
                <div className="rounded-md border border-foreground/10 bg-foreground/5 p-3 flex flex-col gap-3 max-h-40 overflow-auto">
                  {(editingFull?.comments || []).length ? (
                    editingFull!.comments!
                      .slice()
                      .sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime())
                      .map(c => (
                        <div key={c._id} className="rounded-md bg-background/60 border border-foreground/10 p-2">
                          <div className="flex justify-between text-[9px] text-foreground/50">
                            <span>{c.userId.slice(0,6)}</span>
                            <span>{new Date(c.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <div className="mt-1 whitespace-pre-wrap break-words text-[10px]">{c.text}</div>
                        </div>
                      ))
                  ) : (
                    <div className="text-foreground/50 text-[10px] italic">Sem comentários.</div>
                  )}
                </div>
                <div className="flex gap-3 mt-2">
                  <input
                    value={commentText}
                    onChange={(e)=>setCommentText(e.target.value)}
                    placeholder="Novo comentário..."
                    className="h-8 flex-1 rounded-md border border-foreground/20 bg-background px-2 text-[10px]"
                  />
                  <button
                    onClick={addComment}
                    disabled={!commentText.trim() || addingComment}
                    className="h-8 rounded-md bg-foreground px-3 text-background text-[10px] font-medium disabled:opacity-40"
                  >
                    {addingComment ? "..." : "Enviar"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-3 pt-2">
              <button
                onClick={() => editingStory && setDeleteTarget(editingStory)}
                className="h-8 rounded-md bg-red-600 px-3 text-background text-xs font-medium hover:opacity-90"
              >
                Excluir
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => { setEditingStory(null); setEditingFull(null); }}
                  className="h-8 rounded-md border border-foreground/20 px-3 text-xs hover:bg-foreground/5"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveStoryEdits}
                  className="h-8 rounded-md bg-foreground px-3 text-background text-xs font-medium"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmação de exclusão (NEW) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-red-500/30 bg-background p-6 grid gap-5">
            <h4 className="text-sm font-semibold text-red-600">
              Confirmar exclusão
            </h4>
            <div className="text-[11px] text-foreground/70 leading-relaxed space-y-3">
              Tem certeza que deseja excluir a história:
              <br />
              <span className="font-medium text-foreground break-words">
                {deleteTarget.title}
              </span>
              {deleteTarget.description && (
                <div className="mt-2 rounded-md border border-foreground/10 bg-foreground/5 p-2 max-h-40 overflow-auto whitespace-pre-wrap text-foreground/70">
                  {deleteTarget.description}
                </div>
              )}
              <div className="mt-3 text-foreground/60">
                Esta ação é permanente e não pode ser desfeita.
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="h-8 rounded-md border border-foreground/20 px-3 text-xs hover:bg-foreground/5 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={performDelete}
                disabled={deleting}
                className="h-8 rounded-md bg-red-600 px-3 text-background text-xs font-medium hover:opacity-90 disabled:opacity-40"
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );

  async function saveStatusQuick(story: Story, next: Status) {
    if (!projectId) return;
    await fetch(`/api/stories/${story._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await loadAll(projectId);
  }

  // Substitui deleteStoryPersistent: agora somente execução final
  async function performDelete() { // NEW
    if (!projectId || !deleteTarget) return;
    setDeleting(true);
    const id = deleteTarget._id;
    try {
      const res = await fetch(`/api/stories/${id}`, { method: "DELETE" });
      if (res.ok) {
        pushNotice("success", "História excluída");
        setEditingStory(s => (s && s._id === id ? null : s));
        await loadAll(projectId);
      } else {
        pushNotice("error", "Falha ao excluir história");
      }
    } catch {
      pushNotice("error", "Erro de rede ao excluir");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }
}
