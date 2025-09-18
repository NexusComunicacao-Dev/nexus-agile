"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

type PokerSession = {
  _id: string;
  name?: string;
  shortCode?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  activeStoryId: string | null;
  revealed: boolean;
  projectId: string;
};
type VoteRec = { userId: string; value: string; userName?: string }; // já estendido anteriormente

const deck = ["0","1","2","3","5","8","13","21","34","?","☕"];
const numericDeck = deck.filter(d => /^\d+$/.test(d)).map(Number); // NEW
const LS_SELECTED_PROJECT = "wm_selected_project_v1";

export default function PokerPage() {
  const { data: session } = useSession();
  const meId = (session?.user as any)?.id;
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [pokerSession, setPokerSession] = useState<PokerSession | null>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [votes, setVotes] = useState<VoteRec[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [chosenPoints, setChosenPoints] = useState<string>(""); // NEW

  useEffect(() => {
    try {
      const pid = localStorage.getItem(LS_SELECTED_PROJECT);
      setProjectId(pid);
    } catch {}
  }, []);

  const activeStory = useMemo(
    () => stories.find(s => s.id === pokerSession?.activeStoryId),
    [stories, pokerSession]
  );

  const revealed = pokerSession?.revealed ?? false;

  const grouped = useMemo(() => {
    if (!revealed || !pokerSession?.activeStoryId) return null;
    const freq: Record<string, number> = {};
    for (const v of votes) freq[v.value] = (freq[v.value] || 0) + 1;
    return Object.entries(freq).sort((a,b)=>b[1]-a[1]);
  }, [votes, revealed, pokerSession]);

  // NEW média dos valores numéricos
  const averageNumeric = useMemo(() => {
    if (!revealed) return null;
    const numeric = votes
      .map(v => v.value)
      .filter(v => /^\d+$/.test(v))
      .map(Number);
    if (!numeric.length) return null;
    const avg = numeric.reduce((a,b)=>a+b,0)/numeric.length;
    return Number(avg.toFixed(1));
  }, [votes, revealed]);

  const suggestedPoints = useMemo(() => {
    if (averageNumeric == null) return null;
    let best: number | null = null;
    let bestDiff = Infinity;
    for (const n of numericDeck) {
      const diff = Math.abs(n - averageNumeric);
      if (diff < bestDiff || (diff === bestDiff && (best == null || n < best))) {
        best = n;
        bestDiff = diff;
      }
    }
    return best;
  }, [averageNumeric]); // NEW

  useEffect(() => {
    if (!revealed) {
      setChosenPoints("");
    }
  }, [revealed, pokerSession?.activeStoryId]); // NEW

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/poker`, { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        setPokerSession(data.session || null);
        setStories(data.stories || []);
        if (data.session?.activeStoryId && data.votes) setVotes(data.votes);
        else setVotes([]);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Poll a cada 3s
  useEffect(() => {
    if (!projectId) return;
    load();
    const id = setInterval(async () => {
      setPolling(true);
      try {
        if (pokerSession?._id) {
          const r = await fetch(`/api/poker/${pokerSession._id}/vote`);
          if (r.ok) {
            const data = await r.json();
            setPokerSession(data.session);
            setVotes(data.votes || []);
          }
        } else {
          await load();
        }
      } finally {
        setPolling(false);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [projectId, pokerSession?._id, load]);

  async function startSession() {
    if (!projectId) return;
    setCreating(true);
    try {
      await fetch(`/api/projects/${projectId}/poker`, { method: "POST", headers: { "Content-Type":"application/json" } });
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function selectStory(id: string) {
    if (!pokerSession) return;
    setSelecting(true);
    try {
      await fetch(`/api/projects/${projectId}/poker`, {
        method: "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ action: "selectStory", storyId: id })
      });
      await load();
    } finally {
      setSelecting(false);
    }
  }

  async function cast(value: string) {
    if (!pokerSession?.activeStoryId || !pokerSession?._id) return;
    if (revealed) return;
    await fetch(`/api/poker/${pokerSession._id}/vote`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ value })
    });
    // atualização rápida otimista
    setVotes(v => {
      const copy = v.filter(x => x.userId !== meId);
      return [...copy, { userId: meId, value }];
    });
  }

  async function reveal() {
    if (!pokerSession) return;
    await fetch(`/api/projects/${projectId}/poker`, {
      method: "PATCH",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ action: "reveal" })
    });
    await load();
  }

  async function resetVotes() {
    if (!pokerSession) return;
    await fetch(`/api/projects/${projectId}/poker`, {
      method: "PATCH",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ action: "resetVotes" })
    });
    await load();
  }

  // Ajustar applyPoints para usar averageNumeric
  async function applyPoints() {
    if (!pokerSession?._id || !pokerSession.activeStoryId) return;
    const num = Number(chosenPoints);
    if (Number.isNaN(num)) return;
    setApplying(true);
    try {
      await fetch(`/api/poker/${pokerSession._id}/apply`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ points: num })
      });
      await load();
    } finally {
      setApplying(false);
    }
  }

  if (!projectId) {
    return (
      <section className="grid place-items-center py-16 text-center">
        <div>
          <h2 className="text-xl font-semibold">Selecione um projeto</h2>
          <p className="text-xs text-foreground/60 mt-1">Abra /projects e escolha um projeto.</p>
          <a href="/projects" className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-background text-sm font-medium hover:opacity-90">Ir para Projetos</a>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Planning Poker</h1>
          <p className="text-xs text-foreground/60">
            {pokerSession
              ? <>Sessão: <span className="font-medium">{pokerSession.name}</span> <span className="text-foreground/50">({pokerSession.shortCode})</span></>
              : "Nenhuma sessão ativa"}
            {polling && <span className="ml-2 text-[10px] text-foreground/40">atualizando...</span>}
          </p>
        </div>
        {!pokerSession && (
            <button
              onClick={startSession}
              disabled={creating}
              className="h-9 rounded-md bg-foreground px-4 text-background text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Criando..." : "Iniciar sessão"}
            </button>
        )}
      </header>

      {pokerSession && (
        <div className="grid gap-6 md:grid-cols-12">
          {/* Histórias */}
          <div className="md:col-span-5 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
            <h2 className="mb-2 text-sm font-semibold flex items-center justify-between">
              Histórias ({stories.length})
              {selecting && <span className="text-[10px] text-foreground/50">...</span>}
            </h2>
            <ul className="grid gap-2 max-h-[480px] overflow-auto pr-1">
              {stories.map(st => {
                const sel = st.id === pokerSession.activeStoryId;
                return (
                  <li
                    key={st.id}
                    onClick={() => selectStory(st.id)}
                    className={`cursor-pointer rounded-md border px-3 py-2 text-xs transition ${
                      sel
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/15 bg-background hover:border-foreground/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{st.title}</span>
                      {typeof st.points === "number" && (
                        <span className={sel ? "bg-background/20 rounded px-1.5 py-0.5 text-[10px]" : "rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] text-foreground/70"}>
                          {st.points} pts
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
              {!stories.length && <li className="text-[11px] text-foreground/60">Nenhuma história.</li>}
            </ul>
          </div>

          {/* Votação */}
            <div className="md:col-span-7 grid gap-6">
              <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    {activeStory ? activeStory.title : "Selecione uma história"}
                  </h2>
                  {activeStory && (
                    <div className="flex gap-2">
                      <button
                        onClick={reveal}
                        disabled={revealed || !activeStory}
                        className="h-8 rounded-md bg-foreground px-3 text-background text-xs font-medium hover:opacity-90 disabled:opacity-40"
                      >
                        Revelar
                      </button>
                      <button
                        onClick={resetVotes}
                        disabled={!activeStory}
                        className="h-8 rounded-md border border-foreground/20 px-3 text-xs hover:bg-foreground/5 disabled:opacity-40"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
                {activeStory?.description && (
                  <p className="text-[11px] text-foreground/70 whitespace-pre-wrap">{activeStory.description}</p>
                )}
                {!activeStory && (
                  <p className="text-[11px] text-foreground/60">Escolha uma história para iniciar votação.</p>
                )}
              </div>

              <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
                <h3 className="text-sm font-semibold mb-3">Meu voto</h3>
                {!activeStory ? (
                  <div className="text-xs text-foreground/60">Selecione uma história.</div>
                ) : revealed ? (
                  <div className="text-xs text-foreground/60">Revelado — não é possível votar.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {deck.map(c => {
                      const myValue = votes.find(v => v.userId === meId)?.value;
                      const sel = myValue === c;
                      return (
                        <button
                          key={c}
                          onClick={() => cast(c)}
                          disabled={!activeStory || revealed}
                          className={`h-10 w-10 rounded-md border text-sm font-medium ${
                            sel
                              ? "bg-foreground text-background"
                              : "border-foreground/20 hover:bg-foreground/5"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
                <h3 className="text-sm font-semibold mb-2">Votos</h3>
                {!activeStory ? (
                  <div className="text-xs text-foreground/60">Nenhuma história ativa.</div>
                ) : (
                  <ul className="grid gap-1 text-xs">
                    {votes.map(v => (
                      <li key={v.userId} className="flex justify-between rounded-md border border-foreground/10 px-2 py-1">
                        <span className="truncate">{v.userName || v.userId}</span>
                        <span className="text-foreground/60">
                          {revealed ? v.value : "•••"}
                        </span>
                      </li>
                    ))}
                    {!votes.length && (
                      <li className="text-foreground/50 italic">Sem votos</li>
                    )}
                  </ul>
                )}
              </div>

              {/* Resultado (substitui bloco anterior) */}
              <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
                <h3 className="text-sm font-semibold mb-2">Resultado</h3>
                {!activeStory ? (
                  <div className="text-xs text-foreground/60">—</div>
                ) : !revealed ? (
                  <div className="text-xs text-foreground/60">
                    Revele para ver estatísticas.
                  </div>
                ) : grouped && grouped.length ? (
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      {grouped.map(([k, c]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between rounded-md border border-foreground/10 px-2 py-1 text-xs"
                        >
                          <span>{k}</span>
                          <span className="text-foreground/60">{c}</span>
                        </div>
                      ))}
                    </div>

                    <div className="text-[11px] text-foreground/60">
                      Média: {averageNumeric != null ? averageNumeric : "—"} {averageNumeric != null && suggestedPoints != null && (
                        <> • Sugestão Fibonacci: <span className="font-medium">{suggestedPoints}</span></>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 text-[11px]">
                      <div className="flex gap-2">
                        <input
                          value={chosenPoints}
                          onChange={(e) => setChosenPoints(e.target.value)}
                          placeholder="Definir pontos..."
                          className="h-8 flex-1 rounded-md border border-foreground/20 bg-background px-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => suggestedPoints != null && setChosenPoints(String(suggestedPoints))}
                          disabled={suggestedPoints == null}
                          className="h-8 rounded-md border border-foreground/20 px-3 text-[11px] hover:bg-foreground/5 disabled:opacity-40"
                        >
                          Usar {suggestedPoints ?? "—"}
                        </button>
                        <button
                          onClick={applyPoints}
                          disabled={applying || !chosenPoints || Number.isNaN(Number(chosenPoints))}
                          className="h-8 rounded-md bg-foreground px-3 text-background text-[11px] font-medium hover:opacity-90 disabled:opacity-40"
                        >
                          {applying ? "Aplicando..." : "Aplicar"}
                        </button>
                      </div>
                      <div className="text-foreground/50">
                        Você pode ajustar manualmente. Sugestão = valor Fibonacci mais próximo da média.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-foreground/60">Sem votos.</div>
                )}
              </div>
            </div>
        </div>
      )}
    </section>
  );
}
