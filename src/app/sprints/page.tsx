"use client";

import { useMemo, useState, useEffect } from "react";

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
  history?: { status: Status; at: string }[]; // status timeline
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

export default function SprintsPage() {
  const [backlog, setBacklog] = useState<Story[]>([
    sampleStory("Definir visão do produto", { priority: "high", points: 5 }),
    sampleStory("Configurar CI/CD", { priority: "medium", points: 3 }),
  ]);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [history, setHistory] = useState<Sprint[]>([]);

  const [storyModalTarget, setStoryModalTarget] = useState<null | "backlog" | "sprint">(null);
  const [sprintModalOpen, setSprintModalOpen] = useState(false);

  // local persistence
  const LS_BACKLOG = "wm_backlog_v1";
  const LS_ACTIVE_SPRINT = "wm_active_sprint_v1";
  const LS_HISTORY = "wm_sprint_history_v1";
  const LS_POKER_STORY = "wm_poker_story_v1"; // selected story for poker

  // NEW: control hydration to avoid overwriting storage before initial load
  const [hydrated, setHydrated] = useState(false);

  // load from localStorage
  useEffect(() => {
    try {
      const b = localStorage.getItem(LS_BACKLOG);
      const a = localStorage.getItem(LS_ACTIVE_SPRINT);
      const h = localStorage.getItem(LS_HISTORY);
      if (b) setBacklog(sanitizeStories(JSON.parse(b)));
      if (a) setActiveSprint(sanitizeSprint(JSON.parse(a)));
      if (h) setHistory(sanitizeHistory(JSON.parse(h) as Sprint[])); // <— dedupe e sanitiza histórico
    } catch {
      /* ignore */
    } finally {
      setHydrated(true);
    }
  }, []);

  // save to localStorage (only after hydration) — dedupe history on write
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_BACKLOG, JSON.stringify(backlog));
      localStorage.setItem(LS_ACTIVE_SPRINT, JSON.stringify(activeSprint));
      localStorage.setItem(LS_HISTORY, JSON.stringify(dedupeById(history))); // <—
    } catch {
      /* ignore */
    }
  }, [hydrated, backlog, activeSprint, history]);

  const todoCount = useMemo(
    () => activeSprint?.stories.filter((s) => s.status !== "done").length ?? 0,
    [activeSprint]
  );

  function createStory(data: StoryFormData, target: "backlog" | "sprint") {
    const base = toStory(data);
    if (target === "backlog") {
      setBacklog((b) => [base, ...dedupeById(b)]);
    }
    if (target === "sprint") {
      const now = new Date().toISOString();
      const story: Story = { ...base, history: [{ status: "todo", at: now }] }; // initial status event
      setActiveSprint((s) =>
        s ? { ...s, stories: [story, ...dedupeById(s.stories.filter((x) => x.id !== story.id))] } : s
      );
    }
  }

  function addToSprint(id: string) {
    setActiveSprint((s) => s ?? null);
    if (!activeSprint) return;
    setBacklog((prev) => {
      const story = prev.find((x) => x.id === id);
      if (!story) return prev;
      const now = new Date().toISOString();
      setActiveSprint((spr) => {
        if (!spr) return spr;
        const cleaned = spr.stories.filter((x) => x.id !== story.id);
        const withHistory: Story = {
          ...story,
          status: "todo",
          history: story.history?.length ? story.history : [{ status: "todo", at: now }], // initialize status history if missing
        };
        return { ...spr, stories: [withHistory, ...cleaned] };
      });
      return prev.filter((x) => x.id !== id);
    });
  }

  function removeFromSprint(id: string) {
    setActiveSprint((spr) => {
      if (!spr) return spr;
      const story = spr.stories.find((s) => s.id === id);
      const remaining = spr.stories.filter((s) => s.id !== id); // remove duplicates (by id)
      if (story) {
        setBacklog((b) => {
          const cleaned = b.filter((x) => x.id !== id);
          return [{ ...story, status: "todo" }, ...cleaned];
        });
      }
      return { ...spr, stories: remaining };
    });
  }

  function updateStoryStatus(id: string, status: Status) {
    setActiveSprint((spr) =>
      spr
        ? {
            ...spr,
            stories: spr.stories.map((s) => {
              if (s.id !== id) return s;
              if (s.status === status) return s;
              const now = new Date().toISOString();
              const hist = (s.history ?? []).slice();
              const last = hist[hist.length - 1];
              if (!last || last.status !== status) hist.push({ status, at: now }); // append status change to history
              return { ...s, status, history: hist };
            }),
          }
        : spr
    );
  }

  function startSprint(data: SprintFormData) {
    const s: Sprint = {
      id: genId("S"),
      name: data.name,
      goal: data.goal,
      startDate: data.startDate || new Date().toISOString(),
      endDate: data.endDate || undefined,
      stories: [],
      status: "active",
    };
    setActiveSprint(s);
  }

  function finishSprint() {
    setActiveSprint((spr) => {
      if (!spr) return spr;
      const completed = spr.stories.filter((s) => s.status === "done");
      const notCompleted = spr.stories.filter((s) => s.status !== "done");
      const ids = new Set(notCompleted.map((s) => s.id));
      setBacklog((b) => [
        ...notCompleted.map((s) => ({ ...s, status: "todo" as Status })),
        ...b.filter((x) => !ids.has(x.id)),
      ]);
      const archived: Sprint = {
        ...spr,
        status: "completed",
        completedAt: new Date().toISOString(),
        stories: dedupeById(completed),
      };
      setHistory((h) => {
        const filtered = h.filter((x) => x.id !== archived.id);
        return dedupeById<Sprint>([archived, ...filtered]); // <— dedupe
      });
      return null;
    });
  }

  // NEW: send story to Planning Poker
  function goToPoker(story: Story) {
    try {
      localStorage.setItem(LS_POKER_STORY, JSON.stringify(story));
      window.location.href = "/poker";
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sprints</h1>
          <p className="text-xs text-foreground/60">
            Gerencie backlog, inicie/finalize sprints e mova histórias entre backlog e sprint.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!activeSprint ? (
            <button
              onClick={() => setSprintModalOpen(true)}
              className="h-9 rounded-md bg-foreground px-3 text-background text-sm font-medium hover:opacity-90"
            >
              Iniciar sprint
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={finishSprint}
                className="h-9 rounded-md border border-foreground/20 px-3 text-sm hover:bg-foreground/5"
              >
                Finalizar sprint
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Backlog */}
        <section className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4 transition-base">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Backlog</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStoryModalTarget("backlog")}
                className="h-8 rounded-md border border-foreground/20 px-3 text-xs hover:bg-foreground/5"
              >
                Nova história
              </button>
            </div>
          </div>
          <ul className="grid gap-2">
            {backlog.map((s) => (
              <li
                key={s.id}
                className="rounded-md border border-foreground/10 bg-background p-3 animate-pop transition-base overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-foreground/50">{s.id}</div>
                    <div className="text-sm font-medium break-words">{s.title}</div>
                    {s.description && (
                      <div className="mt-1 text-xs text-foreground/70 line-clamp-2 break-words">
                        {s.description}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                      <Badge>{s.priority}</Badge>
                      {s.points ? <Badge>{s.points} pts</Badge> : null}
                      {s.tags?.map((t) => (
                        <Badge key={t}>#{t}</Badge>
                      ))}
                      {s.assignees.length ? (
                        <span className="text-foreground/60">• {s.assignees.join(", ")}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5 disabled:opacity-50"
                      onClick={() => addToSprint(s.id)}
                      disabled={!activeSprint}
                    >
                      Adicionar à sprint
                    </button>
                    {s.points == null && (
                      <button
                        className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
                        onClick={() => goToPoker(s)}
                        title="Enviar para Planning Poker"
                      >
                        Votar no Poker
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {backlog.length === 0 && (
              <li className="text-xs italic text-foreground/50">Backlog vazio</li>
            )}
          </ul>
        </section>

        {/* Sprint ativa */}
        <section className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4 transition-base">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Sprint atual</h2>
              {!activeSprint ? (
                <p className="text-xs text-foreground/60">Nenhuma sprint ativa.</p>
              ) : (
                <p className="text-xs text-foreground/60">
                  {activeSprint.name} • {fmtDate(activeSprint.startDate)}
                  {activeSprint.endDate ? ` → ${fmtDate(activeSprint.endDate)}` : ""}
                  {" • "}
                  pendentes: {todoCount}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStoryModalTarget("sprint")}
                disabled={!activeSprint}
                className="h-8 rounded-md border border-foreground/20 px-3 text-xs hover:bg-foreground/5 disabled:opacity-50"
              >
                Nova história
              </button>
            </div>
          </div>

          {!activeSprint ? (
            <div className="text-xs text-foreground/60">
              Inicie uma sprint para adicionar histórias.
            </div>
          ) : (
            <ul className="grid gap-2">
              {activeSprint.stories.map((s) => (
                <li
                  key={s.id}
                  className="rounded-md border border-foreground/10 bg-background p-3 animate-pop transition-base overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-foreground/50">{s.id}</div>
                      <div className="text-sm font-medium break-words">{s.title}</div>
                      {s.description && (
                        <div className="mt-1 text-xs text-foreground/70 line-clamp-2 break-words">
                          {s.description}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                        <Badge>{s.priority}</Badge>
                        {s.points ? <Badge>{s.points} pts</Badge> : null}
                        {s.tags?.map((t) => (
                          <Badge key={t}>#{t}</Badge>
                        ))}
                        {s.assignees.length ? (
                          <span className="text-foreground/60">• {s.assignees.join(", ")}</span>
                        ) : null}
                      </div>
                      <div className="mt-3">
                        <select
                          value={s.status}
                          onChange={(e) => updateStoryStatus(s.id, e.target.value as Status)}
                          className="h-8 rounded-md border border-foreground/20 bg-background px-2 text-xs"
                        >
                          <option value="todo">A fazer</option>
                          <option value="doing">Em progresso</option>
                          <option value="done">Concluída</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
                        onClick={() => removeFromSprint(s.id)}
                      >
                        Remover
                      </button>
                      {s.points == null && (
                        <button
                          className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
                          onClick={() => goToPoker(s)}
                          title="Enviar para Planning Poker"
                        >
                          Votar no Poker
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
              {activeSprint.stories.length === 0 && (
                <li className="text-xs italic text-foreground/50">
                  Nenhuma história na sprint. Adicione do backlog.
                </li>
              )}
            </ul>
          )}
        </section>
      </div>

      {/* Histórico */}
      <section className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4 transition-base">
        <h2 className="mb-3 text-sm font-semibold">Histórico de sprints</h2>
        <ul className="grid gap-2">
          {history.map((s) => (
            <li key={s.id} className="rounded-md border border-foreground/10 bg-background p-3 animate-slide-up transition-base">
              <div className="flex items-center justify-between">
                <div>
                  <a href={`/sprints/${s.id}`} className="text-sm font-medium hover:underline">{s.name}</a> {/* link to details */}
                  <div className="text-xs text-foreground/60">
                    {fmtDate(s.startDate)} → {fmtDate(s.completedAt || s.endDate || s.startDate)} • concluídas: {s.stories.length}
                  </div>
                </div>
                <div className="text-[10px]"><Badge>finalizada</Badge></div>
              </div>
            </li>
          ))}
          {history.length === 0 && <li className="text-xs italic text-foreground/50">Sem sprints finalizadas.</li>}
        </ul>
      </section>

      {/* Modais */}
      <StoryModal
        open={!!storyModalTarget}
        onClose={() => setStoryModalTarget(null)}
        onSubmit={(data) => {
          if (!storyModalTarget) return;
          createStory(data, storyModalTarget);
          setStoryModalTarget(null);
        }}
      />
      <StartSprintModal
        open={sprintModalOpen}
        onClose={() => setSprintModalOpen(false)}
        onSubmit={(data) => {
          startSprint(data);
          setSprintModalOpen(false);
        }}
      />
    </section>
  );
}

/* Helpers e componentes locais */

function genId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-foreground/10 px-2 py-0.5">{children}</span>
  );
}

/* Story modal */

type StoryFormData = {
  title: string;
  description?: string;
  assignees?: string;
  priority?: "low" | "medium" | "high";
  points?: string;
  tags?: string;
};

function toStory(data: StoryFormData): Story {
  return {
    id: genId("US"),
    title: data.title.trim(),
    description: data.description?.trim() || "",
    assignees: splitCsv(data.assignees),
    priority: data.priority || "medium",
    points: data.points ? Number(data.points) : undefined,
    tags: splitCsv(data.tags),
    createdAt: new Date().toISOString(),
    status: "todo",
  };
}

function splitCsv(v?: string) {
  return v
    ? v
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
}

function StoryModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: StoryFormData) => void;
}) {
  const [form, setForm] = useState<StoryFormData>({
    title: "",
    priority: "medium",
    points: "",
  });

  if (!open) return null;

  function submit() {
    if (!form.title?.trim()) return;
    onSubmit(form);
    setForm({ title: "", priority: "medium", points: "" });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-foreground/10 bg-background p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Nova história</h3>
          <button
            className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1 text-xs">
            <span>Título</span>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
              placeholder="Ex.: Implementar login"
            />
          </label>

          <label className="grid gap-1 text-xs">
            <span>Descrição</span>
            <textarea
              value={form.description || ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="min-h-24 rounded-md border border-foreground/20 bg-background p-3 text-sm"
              placeholder="Detalhes, critérios de aceite, etc."
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs">
              <span>Prioridade</span>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value as StoryFormData["priority"] }))
                }
                className="h-9 rounded-md border border-foreground/20 bg-background px-2 text-sm"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </label>

            <label className="grid gap-1 text-xs">
              <span>Pontos</span>
              <select
                value={form.points}
                onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
                className="h-9 rounded-md border border-foreground/20 bg-background px-2 text-sm"
              >
                <option value="">—</option>
                {[0, 1, 2, 3, 5, 8, 13, 21].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-xs">
            <span>Responsáveis (separe por vírgula)</span>
            <input
              value={form.assignees || ""}
              onChange={(e) => setForm((f) => ({ ...f, assignees: e.target.value }))}
              className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
              placeholder="Ex.: Ana, Bruno"
            />
          </label>

          <label className="grid gap-1 text-xs">
            <span>Tags (separe por vírgula)</span>
            <input
              value={form.tags || ""}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
              placeholder="Ex.: auth, backend"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-foreground/20 px-3 text-sm hover:bg-foreground/5"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            className="h-9 rounded-md bg-foreground px-3 text-background text-sm font-medium hover:opacity-90"
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}

/* Start sprint modal */

type SprintFormData = {
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
};

function StartSprintModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: SprintFormData) => void;
}) {
  const [form, setForm] = useState<SprintFormData>({
    name: "",
    goal: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  });

  if (!open) return null;

  function submit() {
    if (!form.name.trim()) return;
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-foreground/10 bg-background p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Iniciar sprint</h3>
          <button
            className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1 text-xs">
            <span>Nome</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
              placeholder="Ex.: Sprint 1"
            />
          </label>

          <label className="grid gap-1 text-xs">
            <span>Objetivo</span>
            <input
              value={form.goal}
              onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
              className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
              placeholder="Ex.: Entregar MVP de autenticação"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs">
              <span>Início</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span>Fim (opcional)</span>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-foreground/20 px-3 text-sm hover:bg-foreground/5"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            className="h-9 rounded-md bg-foreground px-3 text-background text-sm font-medium hover:opacity-90"
          >
            Iniciar
          </button>
        </div>
      </div>
    </div>
  );
}

/* Dados de exemplo */

function sampleStory(title: string, opts?: Partial<Story>) {
  const base: Story = {
    id: genId("US"),
    title,
    description: "",
    assignees: [],
    priority: "medium",
    points: undefined,
    tags: [],
    createdAt: new Date().toISOString(),
    status: "todo",
  };
  return { ...base, ...opts };
}

// NEW: sanitizers and dedupe
function dedupeById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
function sanitizeStories(stories: Story[] | null | undefined): Story[] {
  if (!Array.isArray(stories)) return [];
  return dedupeById(stories);
}
function sanitizeSprint(s: Sprint | null | undefined): Sprint | null {
  if (!s) return null;
  return { ...s, stories: sanitizeStories(s.stories) };
}

// Normalize history (remove nulls, dedupe and sanitize stories)
function sanitizeHistory(sprints: Sprint[] | null | undefined): Sprint[] {
  if (!Array.isArray(sprints)) return [];
  const cleaned = sprints
    .map(sanitizeSprint)
    .filter((s): s is Sprint => s !== null);
  return dedupeById(cleaned);
}
