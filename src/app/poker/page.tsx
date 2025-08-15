"use client";

import { useEffect, useMemo, useState } from "react";

const deck = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "?", "☕"];

type Vote = { user: string; value?: string };

// Minimal types to integrate with sprint/backlog
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
  history?: { status: Status; at: string }[];
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

const LS_BACKLOG = "wm_backlog_v1";
const LS_ACTIVE_SPRINT = "wm_active_sprint_v1";
const LS_POKER_STORY = "wm_poker_story_v1";

export default function PokerPage() {
  const [participants, setParticipants] = useState<string[]>(["Você"]);
  const [votes, setVotes] = useState<Record<string, Vote>>({
    Você: { user: "Você" },
  });
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState(false);

  // Selected story for voting
  const [story, setStory] = useState<Story | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_POKER_STORY);
      if (raw) setStory(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  function clearStory() {
    try {
      localStorage.removeItem(LS_POKER_STORY);
    } catch {
      /* ignore */
    }
    setStory(null);
  }

  function addParticipant() {
    const n = name.trim();
    if (!n || participants.includes(n)) return;
    setParticipants((p) => [...p, n]);
    setVotes((v) => ({ ...v, [n]: { user: n } }));
    setName("");
  }

  function vote(user: string, value: string) {
    if (revealed) return;
    setVotes((v) => ({ ...v, [user]: { user, value } }));
  }

  function reset() {
    setVotes((v) =>
      Object.fromEntries(Object.values(v).map((x) => [x.user, { user: x.user }]))
    );
    setRevealed(false);
  }

  // group counts
  const summary = useMemo(() => {
    if (!revealed) return null;
    const chosen = Object.values(votes)
      .map((v) => v.value)
      .filter(Boolean) as string[];
    // agrupa contagem
    const freq = Object.groupBy(chosen, (x) => x);
    const entries = Object.entries(freq).map(([k, arr]) => [k, arr?.length ?? 0]);
    entries.sort((a, b) => Number(b[1]) - Number(a[1]));
    return entries;
  }, [votes, revealed]);

  // Get best numeric estimate (most voted; ignores ? and ☕)
  const bestNumeric = useMemo(() => {
    if (!summary) return null;
    for (const [k] of summary) {
      if (/^\d+$/.test(String(k))) return Number(k);
    }
    return null;
  }, [summary]);

  async function applyEstimate() {
    if (!story || bestNumeric == null) return;
    setApplyLoading(true);
    try {
      // Update in backlog
      const braw = localStorage.getItem(LS_BACKLOG);
      if (braw) {
        const b = JSON.parse(braw) as Story[];
        const updated = b.map((s) => (s.id === story.id ? { ...s, points: bestNumeric } : s));
        localStorage.setItem(LS_BACKLOG, JSON.stringify(updated));
      }
      // Update in active sprint
      const araw = localStorage.getItem(LS_ACTIVE_SPRINT);
      if (araw) {
        const s = JSON.parse(araw) as Sprint | null;
        if (s && Array.isArray(s.stories)) {
          const updatedStories = s.stories.map((st) =>
            st.id === story.id ? { ...st, points: bestNumeric } : st
          );
          const next: Sprint = { ...s, stories: updatedStories };
          localStorage.setItem(LS_ACTIVE_SPRINT, JSON.stringify(next));
        }
      }
      // Update local object and clear selection
      setStory((prev) => (prev ? { ...prev, points: bestNumeric } : prev));
      localStorage.removeItem(LS_POKER_STORY);
      // Redirect to /sprints (ensures UI updates)
      window.location.href = "/sprints";
    } finally {
      setApplyLoading(false);
    }
  }

  return (
    <section className="grid gap-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Planning Poker</h2>
          <p className="text-xs text-foreground/60">
            Vote e aplique a estimativa à história selecionada.
          </p>
        </div>
        {story && (
          <button
            onClick={clearStory}
            className="h-9 rounded-md border border-foreground/20 px-3 text-sm hover:bg-foreground/5"
          >
            Limpar história
          </button>
        )}
      </header>

      {story ? (
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs text-foreground/60">{story.id}</div>
              <div className="text-sm font-semibold break-words">{story.title}</div>
            </div>
            {typeof story.points === "number" && (
              <span className="text-[10px] rounded bg-foreground/10 px-2 py-0.5">
                Pontos atuais: {story.points}
              </span>
            )}
          </div>
          {story.description && (
            <p className="text-xs text-foreground/70">{story.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
            <span className="rounded bg-foreground/10 px-2 py-0.5">{story.priority}</span>
            {story.tags?.map((t) => (
              <span key={t} className="rounded bg-foreground/10 px-2 py-0.5">#{t}</span>
            ))}
            {story.assignees?.length ? (
              <span className="text-foreground/60">• {story.assignees.join(", ")}</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="text-xs text-foreground/60">
          Nenhuma história selecionada. Na página de Sprints, clique em “Votar no Poker” em uma história sem pontuação.
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Adicionar participante"
          className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
        />
        <button
          onClick={addParticipant}
          className="h-9 rounded-md border border-foreground/20 px-3 text-sm hover:bg-foreground/5"
        >
          Adicionar
        </button>
        <button
          onClick={() => setRevealed(true)}
          disabled={revealed}
          className="h-9 rounded-md bg-foreground px-3 text-background text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          Revelar
        </button>
        <button
          onClick={reset}
          className="h-9 rounded-md border border-foreground/20 px-3 text-sm hover:bg-foreground/5"
        >
          Reset
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="grid gap-3">
          <h3 className="text-sm font-semibold">Participantes</h3>
          <ul className="grid gap-2">
            {participants.map((u) => (
              <li
                key={u}
                className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{u}</span>
                  <span className="text-xs text-foreground/60">
                    {revealed ? votes[u]?.value ?? "—" : votes[u]?.value ? "votou" : "pendente"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {deck.map((c) => (
                    <button
                      key={c}
                      onClick={() => vote(u, c)}
                      disabled={revealed}
                      className={`h-8 min-w-8 rounded-md border px-2 text-xs ${
                        votes[u]?.value === c && !revealed
                          ? "bg-foreground text-background"
                          : "border-foreground/20 hover:bg-foreground/5"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3">
          <h3 className="text-sm font-semibold">Resumo</h3>
          {!revealed && (
            <div className="text-xs text-foreground/60">
              Aguarde “Revelar” para ver estatísticas.
            </div>
          )}
          {revealed && (
            <div className="grid gap-2">
              {summary?.length ? (
                summary.map(([k, count]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-md border border-foreground/10 p-2"
                  >
                    <span className="text-sm">{k}</span>
                    <span className="text-xs text-foreground/60">{String(count)}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-foreground/60">Sem votos</div>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-foreground/60">
                  Estimativa sugerida: {bestNumeric != null ? `${bestNumeric} pts` : "—"}
                </span>
                <button
                  onClick={applyEstimate}
                  disabled={!story || bestNumeric == null || applyLoading}
                  className="h-9 rounded-md bg-foreground px-3 text-background text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  Aplicar na história
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
