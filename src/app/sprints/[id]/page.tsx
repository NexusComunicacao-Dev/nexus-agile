"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

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
// remove LS_HISTORY constante fixa e use chave dinâmica por projeto
const LEAD_TIME_DAYS_DEFAULT = 7;

export default function SprintDetailsPage() {
  const params = useParams();
  const id = (params as any)?.id?.toString();

  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const pid = localStorage.getItem("wm_selected_project_v1");
      setProjectId(pid);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    try {
      const histKey = projectId
        ? `wm_${projectId}_sprint_history_v1`
        : "wm_sprint_history_v1";
      const raw = localStorage.getItem(histKey);
      if (!raw) return;
      const all = JSON.parse(raw) as Sprint[];
      const s = all.find((x) => x.id === id) || null;
      setSprint(s || null);
    } catch {
      /* ignore */
    }
  }, [id, projectId]);

  const stories = useMemo(() => sprint?.stories ?? [], [sprint]);

  if (!sprint) {
    return (
      <section className="grid place-items-center gap-4 py-16">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Sprint não encontrada</h2>
          <a href="/sprints" className="mt-2 inline-block text-sm underline">Voltar</a>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sprint: {sprint.name}</h1>
          <p className="text-xs text-foreground/60">
            {fmtDate(sprint.startDate)} → {fmtDate(sprint.completedAt || sprint.endDate || sprint.startDate)}
          </p>
        </div>
        <a href="/sprints" className="text-sm underline">Voltar</a>
      </header>

      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
        <h2 className="mb-3 text-sm font-semibold">Histórias concluídas</h2>
        <ul className="grid gap-2">
          {stories.map((st) => {
            const metrics = computeMetrics(st, sprint);
            return (
              <li key={st.id} className="rounded-md border border-foreground/10 bg-background p-3 animate-pop transition-base">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-foreground/50">{st.id}</div>
                    <div className="text-sm font-medium break-words">{st.title}</div>
                    {st.description ? (
                      <div className="mt-1 text-xs text-foreground/70 line-clamp-2 break-words">
                        {st.description}
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                      <Badge>{st.priority}</Badge>
                      {st.points ? <Badge>{st.points} pts</Badge> : null}
                      {st.tags?.map((t) => <Badge key={t}>#{t}</Badge>)}
                    </div>
                  </div>
                  <LeadTimeBadge ms={metrics.leadTimeMs} thresholdDays={LEAD_TIME_DAYS_DEFAULT} />
                </div>

                <div className="mt-3 grid gap-2 text-xs">
                  <div className="flex flex-wrap gap-3">
                    <Metric label="Tempo total na sprint" value={fmtDuration(metrics.totalMs)} />
                    <Metric label="Todo" value={fmtDuration(metrics.byStatus.todo)} />
                    <Metric label="Doing" value={fmtDuration(metrics.byStatus.doing)} />
                    <Metric label="Done" value={fmtDuration(metrics.byStatus.done)} />
                  </div>
                  {!st.history?.length && (
                    <div className="text-foreground/60">
                      Sem dados de transição. Métricas aproximadas ou indisponíveis.
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          {stories.length === 0 && (
            <li className="text-xs italic text-foreground/50">Nenhuma história concluída.</li>
          )}
        </ul>
      </div>
    </section>
  );
}

/* Helpers */

function computeMetrics(story: Story, sprint: Sprint) {
  const byStatus = { todo: 0, doing: 0, done: 0 } as Record<Status, number>;
  const hist = [...(story.history ?? [])].sort((a, b) => +new Date(a.at) - +new Date(b.at));
  // início: primeiro registro válido ou sprint.startDate
  const startAt = hist[0]?.at ?? sprint.startDate;
  // fim: último "done" ou sprint.completedAt
  const doneAt = hist.filter((h) => h.status === "done").slice(-1)[0]?.at ?? sprint.completedAt ?? sprint.endDate ?? sprint.startDate;

  // acumula duração por status entre eventos consecutivos
  for (let i = 0; i < hist.length; i++) {
    const cur = hist[i];
    const next = hist[i + 1];
    const from = new Date(cur.at).getTime();
    const to = next ? new Date(next.at).getTime() : new Date(doneAt).getTime();
    if (to > from) byStatus[cur.status] += to - from;
  }
  // fallback: se não há history, usa totalMs como diferença startAt→doneAt, atribui tudo a "done" (aproximado)
  const totalMs = Math.max(0, new Date(doneAt).getTime() - new Date(startAt).getTime());
  const hasHist = hist.length > 0;
  if (!hasHist) byStatus.done = totalMs;

  const leadTimeMs = totalMs; // lead time = da entrada na sprint até conclusão
  return { totalMs, byStatus, leadTimeMs };
}

function fmtDuration(ms: number) {
  if (!ms || ms <= 0) return "—";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const h = hr % 24;
  const m = min % 60;
  return day ? `${day}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-foreground/10 px-2 py-0.5">{children}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-foreground/10 px-2 py-1">
      <span className="mr-2 text-foreground/60">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function LeadTimeBadge({ ms, thresholdDays }: { ms: number; thresholdDays: number }) {
  const days = ms / (1000 * 60 * 60 * 24);
  const ok = days <= thresholdDays;
  return (
    <span className={`rounded px-2 py-1 text-[11px] ${ok ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600"}`}>
      Lead Time: {days.toFixed(1)}d • SLA {thresholdDays}d
    </span>
  );
}
