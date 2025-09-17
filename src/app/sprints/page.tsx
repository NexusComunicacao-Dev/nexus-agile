"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

// Tipos locais (simplificados)
type Status = "todo" | "doing" | "done";
interface Story {
  _id: string;
  title: string;
  status: Status;
  points?: number;
  priority?: string;
  createdAt: string;
  sprintId?: string;
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

  // Adição: estados de filtro
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [minPts, setMinPts] = useState<string>("");
  const [maxPts, setMaxPts] = useState<string>("");

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
      body: JSON.stringify({ title: newStoryTitle.trim(), projectId }),
    });
    if (res.ok) {
      setNewStoryTitle("");
      setCreatingStory(false);
      if (projectId) await loadAll(projectId);
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
    setStoryStatus(story.status);
  }

  async function saveStoryEdits() {
    if (!editingStory || !projectId) return;
    const res = await fetch(`/api/stories/${editingStory._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        points: storyPoints ? Number(storyPoints) : undefined,
        status: storyStatus,
      }),
    });
    if (res.ok) {
      setEditingStory(null);
      await loadAll(projectId);
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
              className="rounded-md border border-foreground/10 bg-background p-3 text-xs flex items-center justify-between gap-3"
            >
              <span
                className="truncate font-medium cursor-pointer"
                onClick={() => openEdit(st)}
              >
                {st.title}
              </span>
              {active && (
                <button
                  onClick={() => moveToSprint(st)}
                  className="rounded-md border border-foreground/20 px-2 py-1 text-[10px] hover:bg-foreground/5"
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
                  <div className="font-medium truncate">{st.title}</div>
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
              className="rounded-md border border-foreground/10 bg-background p-3 text-xs flex items-center justify-between"
            >
              <span className="truncate">{sp.name}</span>
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
          <div className="w-full max-w-sm rounded-lg border border-foreground/20 bg-background p-4 grid gap-3 text-sm">
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
            <div className="flex gap-2 justify-end">
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
          <div className="w-full max-w-sm rounded-lg border border-foreground/20 bg-background p-4 grid gap-3 text-sm">
            <h3 className="font-semibold text-sm">Nova História (Backlog)</h3>
            <input
              value={newStoryTitle}
              onChange={(e) => setNewStoryTitle(e.target.value)}
              placeholder="Título"
              className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
            />
            <div className="flex gap-2 justify-end">
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
          <div className="w-full max-w-sm rounded-lg border border-foreground/20 bg-background p-4 grid gap-3 text-sm">
            <h3 className="font-semibold text-sm">Editar História</h3>
            <div className="grid gap-2">
              <div className="text-xs font-medium truncate">
                {editingStory.title}
              </div>
              <label className="grid gap-1 text-[10px]">
                Pontos
                <input
                  value={storyPoints}
                  onChange={(e) =>
                    setStoryPoints(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="ex.: 5"
                  className="h-8 rounded-md border border-foreground/20 bg-background px-2 text-xs"
                />
              </label>
              <label className="grid gap-1 text-[10px]">
                Status
                <select
                  value={storyStatus}
                  onChange={(e) => setStoryStatus(e.target.value as Status)}
                  className="h-8 rounded-md border border-foreground/20 bg-background px-2 text-xs"
                >
                  <option value="todo">To Do</option>
                  <option value="doing">Doing</option>
                  <option value="done">Done</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingStory(null)}
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
}
