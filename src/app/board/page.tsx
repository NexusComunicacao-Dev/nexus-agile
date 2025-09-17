"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface BoardItem {
  _id: string;
  title: string;
  status: string;
  order: number;
  projectId: string;
  storyId?: string;
  _story?: { title: string; points?: number; status?: string };
}
const STATUSES = ["backlog", "todo", "doing", "done"] as const;
const LS_SELECTED_PROJECT = "wm_selected_project_v1";

export default function BoardPage() {
  const { data: session } = useSession();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState<string>("backlog");
  const [storyId, setStoryId] = useState("");
  const [dragging, setDragging] = useState<BoardItem | null>(null);

  useEffect(() => {
    try {
      setProjectId(localStorage.getItem(LS_SELECTED_PROJECT));
    } catch {}
  }, []);
  useEffect(() => {
    if (projectId) load();
  }, [projectId]);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/board`, { cache: "no-store" });
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  async function createItem() {
    if (!projectId) return;
    if (!newTitle.trim() && !storyId.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/board`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), status: newStatus, storyId: storyId.trim() || undefined }),
    });
    if (res.ok) {
      setNewTitle("");
      setStoryId("");
      await load();
    }
  }

  function byStatus(s: string) {
    return items.filter((i) => i.status === s).sort((a, b) => a.order - b.order);
  }

  async function reorder(status: string, list: BoardItem[]) {
    if (!projectId) return;
    setItems((prev) => [...prev.filter((i) => i.status !== status), ...list]);
    await fetch(`/api/board/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, status, orderedIds: list.map((i) => i._id) }),
    });
    await load();
  }

  function onDragStart(e: React.DragEvent, item: BoardItem) {
    setDragging(item);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  async function onDrop(e: React.DragEvent, status: string) {
    e.preventDefault();
    if (!dragging) return;
    if (dragging.status === status) {
      setDragging(null);
      return;
    }
    // Atualiza status no servidor (que sincroniza story se existir)
    await fetch(`/api/board/${dragging._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setDragging(null);
    await load();
  }

  async function detachStory(item: BoardItem) {
    await fetch(`/api/board/${item._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detachStory: true }),
    });
    await load();
  }

  async function deleteItem(item: BoardItem) {
    await fetch(`/api/board/${item._id}`, { method: "DELETE" });
    await load();
  }

  if (!projectId) {
    return (
      <div className="p-6 text-sm">
        Selecione um projeto primeiro em{" "}
        <a className="underline" href="/projects">
          Projetos
        </a>
        .
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Board</h1>
          <p className="text-xs text-foreground/60">Kanban integrado às histórias (link opcional).</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título do card"
            className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
          />
          <input
            value={storyId}
            onChange={(e) => setStoryId(e.target.value)}
            placeholder="Story ID (opcional)"
            className="h-9 w-40 rounded-md border border-foreground/20 bg-background px-3 text-sm"
          />
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="h-9 rounded-md border border-foreground/20 bg-background px-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={createItem}
            className="h-9 rounded-md bg-foreground px-3 text-background text-sm font-medium hover:opacity-90"
          >
            Criar
          </button>
        </div>
      </header>

      {loading && <div className="text-xs text-foreground/60">Carregando...</div>}

      <div className="grid gap-4 md:grid-cols-4">
        {STATUSES.map((status) => {
          const col = byStatus(status);
          return (
            <div
              key={status}
              className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3 flex flex-col gap-2 min-h-[320px]"
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, status)}
            >
              <div className="text-xs font-semibold uppercase tracking-wide flex items-center justify-between">
                <span>{status}</span>
                <span className="text-[10px] font-normal text-foreground/50">{col.length}</span>
              </div>
              <div className="flex-1 flex flex-col gap-2">
                {col.map((item) => (
                  <div
                    key={item._id}
                    draggable
                    onDragStart={(e) => onDragStart(e, item)}
                    className={`group rounded-md border border-foreground/10 bg-background p-2 text-xs shadow-sm flex flex-col gap-1 ${
                      dragging?._id === item._id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="font-medium truncate">{item.title}</div>
                    {item._story && (
                      <div className="text-[10px] text-foreground/60 flex items-center gap-2">
                        <span>Status story: {item._story.status}</span>
                        {item._story.points != null && <span>{item._story.points} pts</span>}
                      </div>
                    )}
                    <div className="mt-1 hidden group-hover:flex gap-2">
                      {item.storyId && (
                        <button
                          onClick={() => detachStory(item)}
                          className="rounded-md border border-foreground/20 px-2 py-0.5 text-[10px] hover:bg-foreground/5"
                          title="Desvincular story"
                        >
                          Unlink
                        </button>
                      )}
                      <button
                        onClick={() => deleteItem(item)}
                        className="rounded-md border border-red-400/40 px-2 py-0.5 text-[10px] hover:bg-red-500/10 text-red-600"
                        title="Excluir"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                ))}
                {col.length === 0 && <div className="text-[10px] text-foreground/40 italic">Vazio</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
