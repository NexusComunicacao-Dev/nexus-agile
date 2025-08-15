"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "todo" | "doing" | "done";
type Story = {
  id: string;
  title: string;
  description?: string;
  assignees: string[];
  priority: "low" | "medium" | "high";
  points?: number;
  tags?: string[];
  createdAt: string;
  status: Status;
  history?: { status: Status; at: string }[]; // <— timeline
};
type Sprint = {
  id: string;
  name: string;
  goal?: string;
  startDate: string;
  endDate?: string;
  stories: Story[];
  status: "active" | "completed";
  completedAt?: string;
};

const statusLabel: Record<Status, string> = {
  todo: "A fazer",
  doing: "Em progresso",
  done: "Concluído",
};

// Helper to generate unique IDs for stories
function genId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

const LS_ACTIVE_SPRINT = "wm_active_sprint_v1";

export default function BoardPage() {
  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [title, setTitle] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<Status | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // carregar sprint ativa
  useEffect(() => {
    try {
      const a = localStorage.getItem(LS_ACTIVE_SPRINT);
      if (a) setSprint(JSON.parse(a));
    } catch {
      /* ignore */
    }
  }, []);

  // NEW: escuta alterações vindas de outras páginas/abas
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === LS_ACTIVE_SPRINT) {
        try {
          setSprint(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // salvar sprint ativa
  function persist(next: Sprint | null) {
    setSprint(next);
    try {
      localStorage.setItem(LS_ACTIVE_SPRINT, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const grouped = useMemo(() => {
    const base: Record<Status, Story[]> = { todo: [], doing: [], done: [] };
    if (!sprint) return base;
    for (const s of sprint.stories) base[s.status].push(s);
    return base;
  }, [sprint]);

  function addStory() {
    if (!sprint || !title.trim()) return;
    const now = new Date().toISOString();
    const story: Story = {
      id: genId("NXS"),
      title: title.trim(),
      createdAt: now,
      status: "todo",
      description: "",
      assignees: [],
      priority: "medium",
      tags: [],
      points: undefined,
      history: [{ status: "todo", at: now }], // <—
    };
    const next: Sprint = { ...sprint, stories: [story, ...sprint.stories] };
    setTitle("");
    persist(next);
  }

  function deleteStory(id: string) {
    if (!sprint) return;
    setDeletingId(id);
    setTimeout(() => {
      const next: Sprint = { ...sprint, stories: sprint.stories.filter((x) => x.id !== id) };
      setDeletingId(null);
      persist(next);
    }, 150); // combina com .animate-fade-out
  }

  function moveStory(id: string, to: Status) {
    if (!sprint) return;
    const now = new Date().toISOString();
    const next: Sprint = {
      ...sprint,
      stories: sprint.stories.map((s) => {
        if (s.id !== id) return s;
        if (s.status === to) return s;
        const hist = (s.history ?? []).slice();
        const last = hist[hist.length - 1];
        if (!last || last.status !== to) hist.push({ status: to, at: now }); // <—
        return { ...s, status: to, history: hist };
      }),
    };
    persist(next);
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }
  function onDragOverColumn(e: React.DragEvent, status: Status) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTarget !== status) setDropTarget(status);
  }
  function onDropColumn(e: React.DragEvent, status: Status) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    if (id) moveStory(id, status);
    setDropTarget(null);
    setDraggingId(null);
  }

  if (!sprint || sprint.status !== "active") {
    return (
      <section className="grid place-items-center gap-4 py-16">
        <div className="text-center animate-fade-in">
          <h2 className="text-xl font-semibold">Nenhuma sprint ativa</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Inicie uma sprint em “Sprints” para visualizar o Kanban.
          </p>
          <a
            href="/sprints"
            className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-background text-sm font-medium hover:opacity-90 transition-base"
          >
            Ir para Sprints
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 animate-slide-up">
        <div>
          <h2 className="text-2xl font-semibold">Quadro Kanban • {sprint.name}</h2>
          <p className="text-xs text-foreground/60">
            Arraste os cards entre as colunas. Tudo aqui reflete a sprint ativa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nova história..."
            className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm transition-base focus:border-foreground/40"
          />
          <button
            onClick={addStory}
            className="h-9 rounded-md bg-foreground px-3 text-background text-sm font-medium hover:opacity-90 active:scale-[.98] transition-base"
          >
            Adicionar
          </button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {(Object.keys(grouped) as Status[]).map((status) => (
          <div
            key={status}
            onDragOver={(e) => onDragOverColumn(e, status)}
            onDrop={(e) => onDropColumn(e, status)}
            onDragLeave={() => setDropTarget((s) => (s === status ? null : s))}
            className={`rounded-lg border p-3 transition-base ${
              dropTarget === status
                ? "border-foreground/40 bg-foreground/[0.06]"
                : "border-foreground/10 bg-foreground/[0.02]"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{statusLabel[status]}</h3>
              <span className="text-[10px] rounded bg-foreground/10 px-2 py-0.5">
                {grouped[status].length}
              </span>
            </div>
            <div className="grid gap-2 min-h-8">
              {grouped[status].map((t) => (
                <article
                  key={t.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, t.id)}
                  onDragEnd={onDragEnd}
                  className={`rounded-md border bg-background p-3 shadow-sm transition-base animate-pop overflow-hidden ${
                    draggingId === t.id ? "opacity-70 rotate-1 scale-[1.01]" : ""
                  } ${deletingId === t.id ? "animate-fade-out" : ""} border-foreground/10`}
                >
                  <div className="min-w-0">
                    <div className="text-xs text-foreground/50">{t.id}</div>
                    <div className="text-sm break-words">{t.title}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="rounded bg-foreground/10 px-2 py-0.5">{t.priority}</span>
                      {t.points ? (
                        <span className="rounded bg-foreground/10 px-2 py-0.5">{t.points} pts</span>
                      ) : null}
                      {t.tags?.map((tag) => (
                        <span key={tag} className="rounded bg-foreground/10 px-2 py-0.5">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Botões removidos (remoção só na gestão de sprint) */}
                </article>
              ))}
              {grouped[status].length === 0 && (
                <div className="text-xs text-foreground/40 italic p-2">Solte cards aqui</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
