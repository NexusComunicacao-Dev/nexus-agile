"use client";
import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";

const LS_SELECTED_PROJECT = "wm_selected_project_v1";

const CLIENT_DEFAULT_COLUMNS = [
  { id: "todo", title: "To Do", items: [] },
  { id: "doing", title: "Doing", items: [] },
  { id: "testing", title: "Testing", items: [] },
  { id: "awaiting deploy", title: "Awaiting Deploy", items: [] },
  { id: "deployed", title: "Deployed", items: [] },
  { id: "done", title: "Done", items: [] },
];

export default function BoardPage() {
  const { data: session } = useSession();
  const isAdmin = Boolean((session?.user as any)?.admin);

  // TOASTS
  type Notice = { id: string; type: "success" | "error" | "info"; msg: string };
  const [notices, setNotices] = useState<Notice[]>([]);
  function push(type: Notice["type"], msg: string, ttl = 3000) {
    const id = crypto.randomUUID();
    setNotices(n => [...n, { id, type, msg }]);
    setTimeout(() => setNotices(n => n.filter(x => x.id !== id)), ttl);
  }

  const [projectId, setProjectId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState<string>("backlog");
  const [storyId, setStoryId] = useState("");
  type BoardItem = {
    id: string;
    title: string;
    points?: number;
    __sprint?: boolean;
  };

  const [dragging, setDragging] = useState<BoardItem | null>(null);

  // DnD
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Modal de história (apenas histórias de sprint)
  const [storyModalId, setStoryModalId] = useState<string | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyData, setStoryData] = useState<any>(null);
  const [editPoints, setEditPoints] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingStory, setSavingStory] = useState(false);

  // Modal: adicionar comentários
  const [commentText, setCommentText] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  type Member = { id: string; name: string; initials: string; email?: string }; // NEW
  const [members, setMembers] = useState<Member[]>([]); // NEW
  const [assigneeEdit, setAssigneeEdit] = useState<string>(""); // NEW

  const statusOrder = [
    "todo",
    "doing",
    "testing",
    "awaiting deploy",
    "deployed",
    "done",
  ];

  useEffect(() => {
    try {
      setProjectId(localStorage.getItem(LS_SELECTED_PROJECT));
    } catch {}
  }, []);

  async function load() {
    if (!projectId) return;
    const res = await fetch(
      `/api/projects/${projectId}/board`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const json = await res.json();
      setData(json);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [projectId]);

  useEffect(()=>{
    async function loadMembers() {
      if (!projectId) return;
      const r = await fetch(`/api/projects/${projectId}/members`, { cache: "no-store" });
      if (r.ok) {
        const js = await r.json();
        setMembers(js.members || []);
      }
    }
    loadMembers();
  }, [projectId]);

  const baseColumns = useMemo(() => {
    if (!data?.columns || !Array.isArray(data.columns) || !data.columns.length) {
      return CLIENT_DEFAULT_COLUMNS;
    }
    return data.columns;
  }, [data]);

  const existingIds = useMemo(() => {
    if (!baseColumns) return new Set<string>();
    return new Set(
      baseColumns.flatMap((c: any) =>
        (c.items || []).map((i: any) => i.id || i._id)
      )
    );
  }, [baseColumns]);

  const sprintColumns = useMemo(() => {
    if (!data?.sprintStories) return {};
    return data.sprintStories.reduce(
      (acc: any, s: any) => {
        const st = (s.status || "").toLowerCase();
        (acc[st] = acc[st] || []).push(s);
        return acc;
      },
      {} as Record<string, any[]>
    );
  }, [data]);

  // mergedColumns: nenhuma referência a backlog agora
  const mergedColumns = useMemo(() => {
    return baseColumns
      .filter((c: any) =>
        statusOrder.includes((c.id || c.title || "").toString().toLowerCase())
      )
      .map((col: any) => {
        const statusKey =
          (col.id || col.status || col.title || "").toString().toLowerCase();
        const add = sprintColumns[statusKey] || [];
        const newOnes = add.filter((s: any) => !existingIds.has(s.id));
        return {
          ...col,
          id: statusKey,
          items: [
            ...(col.items || []),
            ...newOnes.map((s: any) => ({
              id: s.id,
              title: s.title,
              points: s.points,
              assigneeId: s.assigneeId || null, // NEW
              __sprint: true,
            })),
          ],
        };
      })
      .sort(
        (a: any, b: any) =>
          statusOrder.indexOf(a.id) - statusOrder.indexOf(b.id)
      );
  }, [baseColumns, sprintColumns, existingIds, statusOrder]);

  async function fetchStory(id: string) {
    setStoryLoading(true);
    try {
      const r = await fetch(`/api/stories/${id}`, { cache: "no-store" });
      if (r.ok) {
        const s = await r.json();
        setStoryData(s);
        setEditPoints(s.points != null ? String(s.points) : "");
        setEditDescription(s.description || "");
        setAssigneeEdit(s.assigneeId || ""); // NEW
      } else {
        push("error", "Falha ao carregar história");
        setStoryModalId(null);
      }
    } finally {
      setStoryLoading(false);
    }
  }

  function openStory(id: string, sprintItem: boolean) {
    if (!sprintItem) return; // só interativa para histórias de sprint
    setStoryModalId(id);
    fetchStory(id);
  }

  async function saveStory() {
    if (!storyData) return;
    setSavingStory(true);
    try {
      const payload: any = {};
      if (editPoints) payload.points = Number(editPoints);
      if (editDescription.trim()) payload.description = editDescription.trim();
      else payload.description = "";
      payload.assigneeId = assigneeEdit || null; // NEW
      const r = await fetch(`/api/stories/${storyData._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        push("success", "História atualizada");
        await load();
        await fetchStory(storyData._id);
      } else {
        push("error", "Falha ao salvar");
      }
    } finally {
      setSavingStory(false);
    }
  }

  async function updateStoryStatus(storyId: string, nextStatus: string) {
    const status = nextStatus.toLowerCase();
    if (!statusOrder.includes(status)) return;
    // backlog -> todo
    try {
      const r = await fetch(`/api/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) push("error", "Falha ao mover");
      else {
        // otimista
        setData((prev: any) => {
          if (!prev) return prev;
            return { ...prev }; // load depois
        });
        await load();
      }
    } catch {
      push("error", "Erro de rede");
    }
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function handleDrop(e: React.DragEvent, columnId: string) {
    e.preventDefault();
    if (!draggingId) return;
    // Verifica se item é sprint story
    const allItems = mergedColumns.flatMap((c: any) => c.items || []);
    const item = allItems.find((i: any) => i.id === draggingId);
    if (item?.__sprint) {
      updateStoryStatus(draggingId, columnId.toLowerCase());
    } else {
      push("info", "Apenas histórias da sprint são movíveis");
    }
    setDraggingId(null);
  }
  function handleDragEnd() {
    setDraggingId(null);
  }

  async function addComment() {
    if (!storyData || !commentText.trim()) return;
    setAddingComment(true);
    try {
      const r = await fetch(`/api/stories/${storyData._id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: commentText.trim() }),
      });
      if (r.ok) {
        const js = await r.json();
        setStoryData((s: any) => ({ ...s, comments: js.comments }));
        setCommentText("");
        push("success", "Comentário adicionado");
      } else {
        push("error", "Falha ao comentar");
      }
    } finally {
      setAddingComment(false);
    }
  }

  if (!projectId) {
    return (
      <section className="grid place-items-center py-16 text-center">
        <div>
          <h2 className="text-xl font-semibold">Selecione um projeto</h2>
          <p className="text-xs text-foreground/60 mt-1">
            Abra a página de Projetos e escolha um.
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
    <section className="grid gap-6 mx-auto max-w-[80vw]"> {/* largura principal da página */}
      {/* TOASTS */}
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
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Board</h1>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Fluxo de trabalho do projeto
              {data?.activeSprint && (
                <> • Sprint ativa: <span className="font-medium text-[var(--brand-primary)]">{data.activeSprint.name}</span></>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="btn-primary h-9 px-4 text-xs"
        >
          Recarregar
        </button>
      </header>

      {loading && <div className="text-xs text-foreground/60">Carregando...</div>}

      {/* NOVO WRAPPER CENTRALIZADO + GRID */}
      <div className="w-full overflow-auto">
        <div className="mx-auto">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {mergedColumns.map((col: any) => (
              <div
                key={col.id || col.title}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, (col.id || col.title || "").toString())}
                className="rounded-lg border border-border bg-background/90 backdrop-blur-sm p-3 flex flex-col gap-3 min-h-[340px] shadow-sm hover:shadow-brand transition"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full mr-2 bg-[var(--brand-primary)]/70" />
                    {col.title || col.id}
                  </h2>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-medium">
                    {(col.items || []).length}
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {(col.items || []).map((it: any) => {
                    const dragging = draggingId === it.id;
                    return (
                      <li
                        key={it.id}
                        draggable={Boolean(it.__sprint)}
                        onDragStart={(e) => handleDragStart(e, it.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => openStory(it.id, Boolean(it.__sprint))}
                        className={`rounded-md border px-2 py-2 text-xs bg-background break-words cursor-pointer select-none transition ${
                          it.__sprint
                            ? "border-indigo-400/50 bg-indigo-400/5 hover:bg-indigo-400/10"
                            : "border-foreground/15 hover:border-foreground/30"
                        } ${dragging ? "opacity-40" : ""}`}
                        title={
                          it.__sprint
                            ? "História da sprint ativa (clique para detalhes / arraste para mudar status)"
                            : "Item estático do board"
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">{it.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {typeof it.points === "number" && (
                              <span
                                className={`rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] ${
                                  it.__sprint
                                    ? "bg-indigo-500/10 text-indigo-600"
                                    : "text-foreground/60"
                                }`}
                              >
                                {it.points} pts
                              </span>
                            )}
                            {it.__sprint && it.assigneeId && (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-semibold">
                                {members.find(m=>m.id===it.assigneeId)?.initials || "?"}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {(!col.items || !col.items.length) && (
                    <li className="text-[11px] text-foreground/40 italic">
                      Vazio
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL HISTÓRIA */}
      {storyModalId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-foreground/20 bg-background p-6 grid gap-5 text-sm"> {/* was p-5 gap-4 */}
            <div className="flex items-start justify-between gap-4 mb-1"> {/* added mb-1 */}
              <h3 className="font-semibold text-sm flex items-center gap-2">
                História{storyData?.title ? ` • ${storyData.title}` : ""}
                {storyData?.assigneeId && (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-semibold">
                    {members.find(m=>m.id===storyData.assigneeId)?.initials || "?"}
                  </span>
                )}
              </h3>
              <button
                onClick={() => {
                  setStoryModalId(null);
                  setStoryData(null);
                }}
                className="rounded-md border border-foreground/20 px-2 py-1 text-[10px] hover:bg-foreground/5"
              >
                Fechar
              </button>
            </div>
            {storyLoading ? (
              <div className="text-xs text-foreground/60">Carregando...</div>
            ) : storyData ? (
              <>
                <div className="grid gap-3 text-[11px]"> {/* was gap-2 */}
                  <div>
                    <span className="font-medium">Status:</span>{" "}
                    {storyData.status}
                  </div>
                  <div>
                    <span className="font-medium">Pontos:</span>{" "}
                    {storyData.points != null ? storyData.points : "—"}
                  </div>
                  <div>
                    <span className="font-medium">Criada:</span>{" "}
                    {new Date(storyData.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="grid gap-4 text-[11px]"> {/* was gap-3 */}
                  <label className="grid gap-2"> {/* was gap-1 */}
                    Pontos (editar)
                    <input
                      value={editPoints}
                      onChange={(e) =>
                        setEditPoints(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      className="h-8 rounded-md border border-foreground/20 bg-background px-2 text-xs"
                      placeholder="ex. 5"
                    />
                  </label>
                  <label className="grid gap-2">
                    Descrição
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      className="rounded-md border border-foreground/20 bg-background p-2 text-xs resize-y"
                      placeholder="Detalhes da história"
                    />
                  </label>
                  <label className="grid gap-2">
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
                  </label>

                  <div className="grid gap-2">
                    <div className="font-medium text-[11px]">Comentários</div>
                    <div className="max-h-48 overflow-auto rounded-md border border-foreground/10 bg-foreground/5 p-3 flex flex-col gap-3"> {/* p-3 gap-3 height bigger */}
                      {(storyData.comments || []).length
                        ? storyData.comments
                            .slice()
                            .sort(
                              (a: any, b: any) =>
                                new Date(a.createdAt).getTime() -
                                new Date(b.createdAt).getTime()
                            )
                            .map((c: any) => (
                              <div
                                key={c._id}
                                className="rounded-md bg-background/60 border border-foreground/10 p-2"
                              >
                                <div className="text-[10px] text-foreground/50 flex justify-between">
                                  <span>{c.userId.slice(0, 6)}</span>
                                  <span>
                                    {new Date(c.createdAt).toLocaleTimeString()}
                                  </span>
                                </div>
                                <div className="mt-1 whitespace-pre-wrap break-words text-[11px]">
                                  {c.text}
                                </div>
                              </div>
                            ))
                        : (
                          <div className="text-[10px] text-foreground/50">
                            Sem comentários.
                          </div>
                        )}
                    </div>
                    <div className="flex gap-3 mt-2"> {/* was gap-2 mt-1 */}
                      <input
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Novo comentário..."
                        className="h-8 flex-1 rounded-md border border-foreground/20 bg-background px-2 text-xs"
                      />
                      <button
                        onClick={addComment}
                        disabled={!commentText.trim() || addingComment}
                        className="h-8 rounded-md bg-foreground px-3 text-background text-[11px] font-medium disabled:opacity-40"
                      >
                        {addingComment ? "..." : "Enviar"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pt-2"> {/* was gap-2 */}
                  {["todo","doing","testing","awaiting deploy","deployed","done"].map((st) => {
                    const active = storyData.status === st;
                    return (
                      <button
                        key={st}
                        onClick={() => updateStoryStatus(storyData._id, st)}
                        disabled={active}
                        className={`h-8 rounded-md px-3 text-[11px] font-medium border transition
                          ${active
                            ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-brand"
                            : "border-border hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10"}`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={saveStory}
                    disabled={savingStory}
                    className="h-8 rounded-md bg-foreground px-4 text-background text-xs font-medium hover:opacity-90 disabled:opacity-40"
                  >
                    {savingStory ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-xs text-red-600">
                Falha ao carregar história.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}