"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";

interface Sprint {
  _id: string;
  name: string;
  goal?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  projectId: string;
}
interface Story {
  id: string;
  title: string;
  status: string;
  points?: number;
  assigneeId?: string | null;
}
type Member = { id: string; name: string; initials: string };

export default function SprintDetailPage() {
  const params = useParams();
  const sprintId = params?.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]); // NEW

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/sprints/${sprintId}`, { cache: "no-store" });
    if (!res.ok) {
      setError("Falha ao carregar sprint");
      setLoading(false);
      return;
    }
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    if (sprintId) load();
  }, [sprintId]);

  useEffect(() => {
    if (data?.project?.id) {
      fetch(`/api/projects/${data.project.id}/members`, { cache: "no-store" })
        .then(r => r.ok ? r.json() : { members: [] })
        .then(j => setMembers(j.members || []))
        .catch(()=>{});
    }
  }, [data?.project?.id]); // NEW

  const grouped = useMemo(() => {
    if (!data?.stories) return {};
    return data.stories.reduce((acc: any, s: Story) => {
      (acc[s.status] = acc[s.status] || []).push(s);
      return acc;
    }, {});
  }, [data]);

  // NEW helper para formato
  function fmtDays(d: number|undefined) {
    return d == null ? "—" : `${d}d`;
  }
  function initials(id?: string|null) {
    if (!id) return "?";
    const m = members.find(mm => mm.id === id);
    return m?.initials || id.slice(0,2).toUpperCase();
  }

  if (loading) {
    return (
      <section className="py-12 text-xs text-foreground/60">
        Carregando sprint...
      </section>
    );
  }
  if (error) {
    return (
      <section className="py-12 text-xs text-red-600">
        {error}
      </section>
    );
  }
  if (!data) {
    return (
      <section className="py-12 text-xs text-foreground/60">
        Dados indisponíveis.
      </section>
    );
  }

  const sprint = data.sprint;
  const m = data.metrics || {};

  return (
    <section className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">
            Sprint • {sprint.name}
          </h1>
          <p className="text-xs text-foreground/60">
            Projeto: {data.project?.name} • Status: {sprint.status}
            {sprint.completedAt && (
              <> • Finalizada em {new Date(sprint.completedAt).toLocaleDateString()}</>
            )}
          </p>
          {sprint.goal && (
            <p className="text-[11px] text-foreground/60 whitespace-pre-wrap">
              Objetivo: {sprint.goal}
            </p>
          )}
        </div>
        <button
          onClick={load}
          className="h-9 rounded-md border border-foreground/20 px-3 text-xs hover:bg-foreground/5"
        >
          Recarregar
        </button>
      </header>

      {/* Métricas agregadas */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
        <Metric label="Histórias" value={m.totalStories} />
        <Metric label="Concluídas" value={m.doneStories} />
        <Metric label="Progresso" value={`${m.progressPct || 0}%`} />
        <Metric label="Pontos (total)" value={m.totalPoints} />
        <Metric label="Pontos concluídos" value={m.completedPoints} />
        <Metric label="Lead (médio)" value={`${m.avgLeadDays ?? 0}d`} />
        <Metric label="Lead alvo" value={`${m.leadTargetDays}d`} />
        <Metric label="Dentro do alvo" value={`${m.leadWithinTarget}/${m.totalStories}`} />
        <Metric label="% Dentro alvo" value={`${m.leadWithinTargetPct || 0}%`} />
      </div>

      {/* Detalhes por história (tabela de lead time) */}
      <div className="grid gap-3">
        <h2 className="text-sm font-semibold">Lead Time por História</h2>
        <div className="overflow-auto rounded-md border border-foreground/10">
          <table className="min-w-full text-[11px]">
            <thead className="bg-foreground/5">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">História</th>
                <th className="px-3 py-2 font-medium">Resp.</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Pontos</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Variance</th>
                <th className="px-3 py-2 font-medium">Dentro alvo</th>
                <th className="px-3 py-2 font-medium">todo</th>
                <th className="px-3 py-2 font-medium">doing</th>
                <th className="px-3 py-2 font-medium">testing</th>
                <th className="px-3 py-2 font-medium">awaiting deploy</th>
                <th className="px-3 py-2 font-medium">deployed</th>
                <th className="px-3 py-2 font-medium">done</th>
              </tr>
            </thead>
            <tbody>
              {data.stories.map((s:any) => {
                const lead = s.lead;
                return (
                  <tr key={s.id} className="border-t border-foreground/10 hover:bg-foreground/5">
                    <td className="px-3 py-2 font-medium max-w-[220px] truncate">{s.title}</td>
                    <td className="px-3 py-2">
                      {s.assigneeId ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-semibold">
                          {initials(s.assigneeId)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2">{s.status}</td>
                    <td className="px-3 py-2">{typeof s.points === "number" ? s.points : "—"}</td>
                    <td className="px-3 py-2">{lead ? fmtDays(lead.total.days) : "—"}</td>
                    <td className={`px-3 py-2 ${lead ? (lead.varianceDays > 0 ? "text-red-600" : "text-green-600") : ""}`}>
                      {lead ? (lead.varianceDays > 0 ? `+${lead.varianceDays}d` : `${lead.varianceDays}d`) : "—"}
                    </td>
                    <td className="px-3 py-2">{lead ? (lead.withinTarget ? "Sim" : "Não") : "—"}</td>
                    {["todo","doing","testing","awaiting deploy","deployed","done"].map(st => (
                      <td key={st} className="px-3 py-2">
                        {lead ? fmtDays(lead.perStatus[st]?.days) : "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {data.stories.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-4 text-center text-foreground/50">
                    Nenhuma história.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribuição por status (ajustar badge direita: mostrar variance) */}
      <div className="grid gap-6">
        {["todo","doing","testing","awaiting deploy","deployed","done"].filter(st => grouped[st]?.length)
          .map(status => (
          <div key={status} className="grid gap-2">
            <h2 className="text-sm font-semibold capitalize">
              {status} ({grouped[status].length})
            </h2>
            <ul className="grid gap-2">
              {grouped[status].map((s: any) => {
                const lead = s.lead;
                return (
                  <li
                    key={s.id}
                    className="rounded-md border border-foreground/10 bg-background p-3 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        <span className="truncate">{s.title}</span>
                        {typeof s.points === "number" && (
                          <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] text-foreground/70">
                            {s.points} pts
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-foreground/50">
                        {s.status}
                        {lead && ` • ${lead.total.days}d`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {lead && (
                        <span className={`text-[10px] font-medium ${lead.varianceDays > 0 ? "text-red-600" : "text-green-600"}`}>
                          {lead.varianceDays > 0 ? `+${lead.varianceDays}d` : `${lead.varianceDays}d`}
                        </span>
                      )}
                      {s.assigneeId && (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-semibold">
                          {initials(s.assigneeId)}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Lista completa (substituir avatar numérico por iniciais) */}
      <div className="grid gap-3">
        <h2 className="text-sm font-semibold">Todas as histórias ({data.stories.length})</h2>
        <ul className="grid gap-2">
          {data.stories.map((s: any) => {
            const lead = s.lead;
            return (
              <li
                key={s.id}
                className="rounded-md border border-foreground/10 bg-background p-3 text-xs flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    <span className="truncate">{s.title}</span>
                    {typeof s.points === "number" && (
                      <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] text-foreground/70">
                        {s.points} pts
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-foreground/50">
                    {s.status}
                    {lead && ` • ${lead.total.days}d (${lead.withinTarget ? "OK" : "OUT"})`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {lead && (
                    <span className={`text-[10px] font-medium ${lead.varianceDays > 0 ? "text-red-600" : "text-green-600"}`}>
                      {lead.varianceDays > 0 ? `+${lead.varianceDays}d` : `${lead.varianceDays}d`}
                    </span>
                  )}
                  {s.assigneeId && (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-semibold">
                      {initials(s.assigneeId)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
          {data.stories.length === 0 && (
            <li className="text-[11px] text-foreground/60">
              Nenhuma história.
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-background p-4 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-foreground/50">{label}</span>
      <span className="text-sm font-semibold">{value ?? "—"}</span>
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
