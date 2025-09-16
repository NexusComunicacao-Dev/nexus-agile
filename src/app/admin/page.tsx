"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type AdminRequest = {
  _id: string;
  email: string;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
};

// NEW: invitation DTO
type Invite = {
  id: string;
  email: string;
  projectId: string;
  projectName: string;
  invitedBy: string;
  createdAt: string;
};

type Notice = { id: string; type: "success" | "error" | "info"; msg: string };

export default function AdminPage() {
  const { data: session } = useSession();
  const isAdmin = Boolean((session?.user as any)?.admin);

  const [promoteEmail, setPromoteEmail] = useState("");
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loadingReq, setLoadingReq] = useState(false);

  // NEW: invitations state
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);

  const [notices, setNotices] = useState<Notice[]>([]);

  function pushNotice(type: Notice["type"], msg: string, ttl = 4000) {
    const id = crypto.randomUUID();
    setNotices((n) => [...n, { id, type, msg }]);
    setTimeout(() => {
      setNotices((n) => n.filter((x) => x.id !== id));
    }, ttl);
  }

  async function loadRequests() {
    if (!isAdmin) return;
    setLoadingReq(true);
    const res = await fetch("/api/admin/requests", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    }
    setLoadingReq(false);
  }

  // NEW: load invitations
  async function loadInvites() {
    if (!isAdmin) return;
    setLoadingInv(true);
    const res = await fetch("/api/admin/invitations", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setInvites(Array.isArray(data) ? data : []);
    }
    setLoadingInv(false);
  }

  useEffect(() => {
    if (isAdmin) {
      loadRequests();
      loadInvites();
    }
  }, [isAdmin]);

  async function promote() {
    const email = promoteEmail.trim().toLowerCase();
    if (!email) return;
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const out = await res.json().catch(() => ({}));
    if (res.ok) {
      pushNotice("success", "Usuário promovido. Requer relogar.");
      setPromoteEmail("");
    } else {
      pushNotice("error", out?.error || "Falha ao promover");
    }
  }

  async function demote() {
    const email = promoteEmail.trim().toLowerCase();
    if (!email) return;
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const out = await res.json().catch(() => ({}));
    if (res.ok) {
      pushNotice("success", "Usuário rebaixado. Requer relogar.");
      setPromoteEmail("");
    } else {
      pushNotice("error", out?.error || "Falha ao rebaixar");
    }
  }

  async function updateRequest(id: string, status: "approved" | "rejected") {
    const res = await fetch("/api/admin/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      pushNotice("success", `Pedido ${status === "approved" ? "aprovado" : "rejeitado"}.`);
      await loadRequests();
    } else {
      const out = await res.json().catch(() => ({}));
      pushNotice("error", out?.error || "Erro ao atualizar pedido");
    }
  }

  // NEW: resend invitation
  async function resendInvite(id: string) {
    const res = await fetch("/api/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      pushNotice("success", "Convite reenviado.");
    } else {
      const out = await res.json().catch(() => ({}));
      pushNotice("error", out?.error || "Erro ao reenviar");
    }
  }

  async function cancelInvite(id: string) {
    const res = await fetch("/api/admin/invitations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const out = await res.json().catch(() => ({}));
    if (res.ok) {
      setInvites((v) => v.filter((i) => i.id !== id));
      pushNotice("success", "Convite cancelado.");
    } else {
      pushNotice("error", out?.error || "Erro ao cancelar convite");
    }
  }

  if (!isAdmin) {
    return (
      <section className="grid place-items-center py-16">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-xs text-foreground/60">
            Esta área é apenas para administradores. Se precisa de acesso,
            abra um pedido de admin.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-8">
      {/* TOAST CONTAINER */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {notices.map((n) => (
          <div
            key={n.id}
            className={`rounded-md px-3 py-2 text-xs shadow border ${
              n.type === "success"
                ? "bg-green-500/10 border-green-500/30 text-green-700"
                : n.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-600"
                : "bg-foreground/10 border-foreground/30 text-foreground/80"
            }`}
          >
            {n.msg}
          </div>
        ))}
      </div>

      <header>
        <h1 className="text-2xl font-semibold">Administração</h1>
        <p className="text-xs text-foreground/60">
          Gerencie privilégios de administradores, pedidos e convites.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Painel promoção */}
        <div className="rounded-lg border border-foreground/10 p-4">
          <h2 className="mb-2 text-sm font-semibold">Promover / Rebaixar</h2>
          <div className="flex gap-2">
            <input
              value={promoteEmail}
              onChange={(e) => setPromoteEmail(e.target.value)}
              placeholder="email@empresa.com"
              className="h-9 flex-1 rounded-md border border-foreground/20 bg-background px-3 text-sm"
            />
            <button
              onClick={promote}
              className="h-9 rounded-md border border-foreground/20 px-3 text-xs hover:bg-foreground/5"
            >
              Promover
            </button>
            <button
              onClick={demote}
              className="h-9 rounded-md border border-foreground/20 px-3 text-xs hover:bg-foreground/5"
            >
              Rebaixar
            </button>
          </div>
          <p className="mt-2 text-[11px] text-foreground/60">
            Usuário precisa ter feito login ao menos uma vez. Após mudança: relogar.
          </p>
        </div>

        {/* Pedidos de admin */}
        <div className="rounded-lg border border-foreground/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pedidos de Admin</h2>
            <button
              onClick={loadRequests}
              className="h-8 rounded-md border border-foreground/20 px-2 text-xs hover:bg-foreground/5"
            >
              Recarregar
            </button>
          </div>
          {loadingReq ? (
            <div className="text-xs text-foreground/60">Carregando...</div>
          ) : requests.length === 0 ? (
            <div className="text-xs text-foreground/60">Sem pedidos.</div>
          ) : (
            <ul className="grid gap-2">
              {requests.map((r) => (
                <li
                  key={r._id}
                  className="rounded-md border border-foreground/10 bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium">{r.email}</div>
                      <div className="text-[11px] text-foreground/60">
                        {r.reason || "(sem motivo)"} • {r.status}
                      </div>
                    </div>
                    {r.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateRequest(r._id, "approved")}
                          className="rounded-md border border-foreground/20 px-2 py-1 text-[10px] hover:bg-foreground/5"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => updateRequest(r._id, "rejected")}
                          className="rounded-md border border-foreground/20 px-2 py-1 text-[10px] hover:bg-foreground/5"
                        >
                          Rejeitar
                        </button>
                        <button
                          onClick={() => setPromoteEmail(r.email)}
                          className="rounded-md border border-foreground/20 px-2 py-1 text-[10px] hover:bg-foreground/5"
                          title="Pré-carregar para promoção"
                        >
                          Promover
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-foreground/60">
            Aprovar não promove automaticamente; clique em Promover para conceder acesso.
          </p>
        </div>

        {/* Convites pendentes */}
        <div className="rounded-lg border border-foreground/10 p-4 md:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Convites Pendentes</h2>
            <button
              onClick={loadInvites}
              className="h-8 rounded-md border border-foreground/20 px-2 text-xs hover:bg-foreground/5"
            >
              Recarregar
            </button>
          </div>
          {loadingInv ? (
            <div className="text-xs text-foreground/60">Carregando...</div>
          ) : invites.length === 0 ? (
            <div className="text-xs text-foreground/60">Sem convites pendentes.</div>
          ) : (
            <ul className="grid gap-2">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="rounded-md border border-foreground/10 bg-background p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{inv.email}</div>
                    <div className="text-[11px] text-foreground/60">
                      Projeto: {inv.projectName} • Criado: {new Date(inv.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => resendInvite(inv.id)}
                      className="rounded-md border border-foreground/20 px-2 py-1 text-[10px] hover:bg-foreground/5"
                    >
                      Reenviar
                    </button>
                    <button
                      onClick={() => cancelInvite(inv.id)}
                      className="rounded-md border border-red-400/40 px-2 py-1 text-[10px] hover:bg-red-500/10 text-red-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-foreground/60">
            Convites cancelados não serão aplicados mesmo que o usuário faça login.
          </p>
        </div>
      </div>
    </section>
  );
}
