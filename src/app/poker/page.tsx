"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface PokerSession {
  _id: string;
  projectId: string;
  storyId?: string;
  ownerId: string;
  status: string;
  deck: (number | "?")[];
  createdAt: string;
  revealedAt?: string;
  consensusPoints?: number;
}
interface PokerVote {
  _id: string;
  sessionId: string;
  userId: string;
  value: number | "?" | null;
}

const LS_SELECTED_PROJECT = "wm_selected_project_v1";
const DEFAULT_DECK: (number | "?")[] = [1, 2, 3, 5, 8, 13, 21, "?"];

export default function PokerPage() {
  const { data: session } = useSession();
  const meId = (session?.user as any)?.id as string | undefined;
  const [projectId, setProjectId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<PokerSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [storyId, setStoryId] = useState("");
  const [current, setCurrent] = useState<PokerSession | null>(null);
  const [votes, setVotes] = useState<PokerVote[]>([]);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    try {
      setProjectId(localStorage.getItem(LS_SELECTED_PROJECT));
    } catch {}
  }, []);
  useEffect(() => {
    if (projectId) loadList();
  }, [projectId]);
  useEffect(() => {
    if (current) loadSession(current._id);
  }, [current?._id]);

  async function loadList() {
    if (!projectId) return;
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/poker`, { cache: "no-store" });
    if (res.ok) setSessions(await res.json());
    setLoading(false);
  }
  async function loadSession(id: string) {
    const res = await fetch(`/api/poker/${id}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setCurrent(data.session);
      setVotes(data.votes);
    }
  }
  async function createSession() {
    if (!projectId) return;
    setCreating(true);
    const res = await fetch(`/api/projects/${projectId}/poker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId: storyId.trim() || undefined, deck: DEFAULT_DECK }),
    });
    if (res.ok) {
      setStoryId("");
      await loadList();
    }
    setCreating(false);
  }
  async function vote(val: number | "?" | null) {
    if (!current) return;
    setVoting(true);
    await fetch(`/api/poker/${current._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "vote", value: val }),
    });
    await loadSession(current._id);
    setVoting(false);
  }
  async function reveal() {
    if (!current) return;
    await fetch(`/api/poker/${current._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reveal" }),
    });
    await loadSession(current._id);
    await loadList();
  }
  async function close() {
    if (!current) return;
    await fetch(`/api/poker/${current._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    await loadSession(current._id);
    await loadList();
  }

  const myVote = votes.find((v) => v.userId === meId)?.value ?? null;

  if (!projectId)
    return (
      <div className="p-6 text-sm">
        Selecione um projeto primeiro em{" "}
        <a className="underline" href="/projects">
          Projetos
        </a>
        .
      </div>
    );

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Planning Poker</h1>
          <p className="text-xs text-foreground/60">
            Estimativa colaborativa. Revele somente após todos votarem.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            value={storyId}
            onChange={(e) => setStoryId(e.target.value)}
            placeholder="Story ID (opcional)"
            className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
          />
          <button
            onClick={createSession}
            disabled={creating}
            className="h-9 rounded-md bg-foreground px-3 text-background text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            Nova sessão
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-foreground/10 p-4 grid gap-3">
          <h2 className="text-sm font-semibold">Sessões</h2>
          {loading && <div className="text-xs text-foreground/60">Carregando...</div>}
          <ul className="grid gap-2 max-h-80 overflow-auto pr-1">
            {sessions.map((s) => (
              <li
                key={s._id}
                onClick={() => setCurrent(s)}
                className={`cursor-pointer rounded-md border border-foreground/10 p-2 text-xs flex justify-between items-center ${
                  current?._id === s._id
                    ? "bg-foreground/10"
                    : "bg-background hover:bg-foreground/5"
                }`}
              >
                <span className="truncate">{s.storyId || s._id}</span>
                <span className="text-[10px] text-foreground/50">{s.status}</span>
              </li>
            ))}
            {sessions.length === 0 && !loading && (
              <li className="text-[11px] text-foreground/60">Nenhuma sessão.</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border border-foreground/10 p-4 grid gap-3 md:col-span-2">
          {!current ? (
            <div className="text-xs text-foreground/60">Selecione uma sessão.</div>
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold">Sessão: {current.storyId || current._id}</div>
                <div className="flex gap-2 text-[10px] text-foreground/60">
                  Status: {current.status}
                  {current.consensusPoints != null ? ` • Consenso: ${current.consensusPoints}` : ""}
                </div>
              </div>
              {current.status === "active" && (
                <div className="flex flex-wrap gap-2">
                  {current.deck.map((card) => (
                    <button
                      key={String(card)}
                      onClick={() => vote(card)}
                      disabled={voting}
                      className={`h-10 w-10 rounded-md border text-xs font-medium flex items-center justify-center ${
                        myVote === card ? "bg-foreground text-background" : "bg-background hover:bg-foreground/5"
                      }`}
                    >
                      {card}
                    </button>
                  ))}
                  <button
                    onClick={() => vote(null)}
                    disabled={voting}
                    className={`h-10 px-3 rounded-md border text-xs ${
                      myVote === null ? "bg-foreground text-background" : "bg-background hover:bg-foreground/5"
                    }`}
                  >
                    Clear
                  </button>
                </div>
              )}
              {current.status === "revealed" && (
                <div className="text-xs text-foreground/70">
                  Cartas reveladas. Consenso:{" "}
                  {current.consensusPoints != null ? current.consensusPoints : "-"}
                </div>
              )}
              <div className="flex gap-2 text-[10px] flex-wrap">
                {current.status === "active" && (
                  <button
                    onClick={reveal}
                    className="rounded-md border border-foreground/20 px-3 py-1 hover:bg-foreground/5"
                  >
                    Revelar
                  </button>
                )}
                {current.status !== "closed" && (
                  <button
                    onClick={close}
                    className="rounded-md border border-foreground/20 px-3 py-1 hover:bg-foreground/5"
                  >
                    Fechar
                  </button>
                )}
              </div>
              <div className="grid gap-2">
                <h3 className="text-[11px] font-semibold">Votos</h3>
                <ul className="grid gap-1 max-h-56 overflow-auto pr-1">
                  {votes.map((v) => (
                    <li key={v._id} className="text-[11px] flex justify-between border-b border-foreground/5 py-1">
                      <span className="truncate">{v.userId}</span>
                      <span className="font-mono">
                        {current.status === "active" ? (v.value == null ? "…" : "•") : v.value == null ? "—" : v.value}
                      </span>
                    </li>
                  ))}
                  {votes.length === 0 && <li className="text-[11px] text-foreground/50">Sem votos.</li>}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
