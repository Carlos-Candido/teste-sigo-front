"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/Auth/RouteGuards";
import { DashboardSidebar } from "@/components/Dashboard/DashboardSidebar";
import { NavBar } from "@/components/Sidebar/NavBar";
import { useAuth } from "@/hooks/useAuth";
import { getAllowedManagementConfigs, normalizeRole } from "@/lib/accessControl";
import {
  fetchAllDashboardRecords,
  getDashboardValue,
  toDashboardNumber,
} from "@/lib/dashboardData";
import { entityConfigs } from "@/models/entityConfigs";
import { routes } from "@/navigation/routes";

type RecordItem = Record<string, unknown>;
type OrderStatus =
  | "Aguardando"
  | "Em diagnóstico"
  | "Em manutenção"
  | "Aguardando peça"
  | "Concluída";

const statusOrder: OrderStatus[] = [
  "Aguardando",
  "Em diagnóstico",
  "Em manutenção",
  "Aguardando peça",
  "Concluída",
];

const statusStyles: Record<OrderStatus, string> = {
  Aguardando: "border-amber-200 bg-amber-50 text-amber-700",
  "Em diagnóstico": "border-violet-200 bg-violet-50 text-violet-700",
  "Em manutenção": "border-blue-200 bg-blue-50 text-blue-700",
  "Aguardando peça": "border-orange-200 bg-orange-50 text-orange-700",
  Concluída: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const chartColors: Record<OrderStatus, string> = {
  Aguardando: "bg-amber-400",
  "Em diagnóstico": "bg-violet-500",
  "Em manutenção": "bg-blue-500",
  "Aguardando peça": "bg-orange-500",
  Concluída: "bg-emerald-500",
};

const getValue = (item: RecordItem | undefined, ...keys: string[]): unknown => {
  return getDashboardValue(item, ...keys);
};

const getId = (item: RecordItem | undefined): string =>
  String(getValue(item, "Id", "id") ?? "");

const normalizeText = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

const resolveOrderStatus = (
  order: RecordItem,
  vehicle?: RecordItem
): OrderStatus => {
  const raw = getValue(order, "Status", "Situacao") ?? getValue(vehicle, "Status");
  const normalized = normalizeText(raw);

  if (["0", "pendente", "aguardando", "aguardandoaprovacao", "aprovacaopendente"].includes(normalized)) {
    return "Aguardando";
  }
  if (["diagnostico", "emdiagnostico"].includes(normalized)) {
    return "Em diagnóstico";
  }
  if (["manutencao", "emmanutencao", "2", "emandamento"].includes(normalized)) {
    return "Em manutenção";
  }
  if (["aguardandopeca", "aguardandopecas", "1"].includes(normalized)) {
    return "Aguardando peça";
  }
  if (["concluida", "concluido", "3", "finalizada", "finalizado"].includes(normalized)) {
    return "Concluída";
  }

  const endDate = new Date(String(getValue(order, "DataFim") ?? ""));
  return Number.isNaN(endDate.getTime()) || endDate >= new Date()
    ? "Em diagnóstico"
    : "Concluída";
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

export default function DashboardPage() {
  const router = useRouter();
  const { baseUrl, token, userRole, oficinaId } = useAuth();
  const configs = useMemo(
    () =>
      getAllowedManagementConfigs(entityConfigs, userRole, oficinaId).filter(
        (config) => ["pedidos", "veiculos", "clientes"].includes(config.key)
      ),
    [oficinaId, userRole]
  );
  const [orders, setOrders] = useState<RecordItem[]>([]);
  const [vehicles, setVehicles] = useState<RecordItem[]>([]);
  const [clients, setClients] = useState<RecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (normalizeRole(userRole) === "cliente") router.replace(routes.clientHome);
  }, [router, userRole]);

  useEffect(() => {
    let mounted = true;
    const loadDashboard = async () => {
      setIsLoading(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const results = await Promise.all(
        configs.map(async (config) => {
          if (!config.listPath) return [config.key, []] as const;
          const items = await fetchAllDashboardRecords(baseUrl, config.listPath, headers);
          return [config.key, items] as const;
        })
      );
      if (!mounted) return;
      const records = Object.fromEntries(results) as Record<string, RecordItem[]>;
      setOrders(records.pedidos ?? []);
      setVehicles(records.veiculos ?? []);
      setClients(records.clientes ?? []);
      setIsLoading(false);
    };
    void loadDashboard();
    return () => {
      mounted = false;
    };
  }, [baseUrl, configs, token]);

  const vehicleById = useMemo(
    () => new Map(vehicles.map((vehicle) => [getId(vehicle), vehicle])),
    [vehicles]
  );
  const clientById = useMemo(
    () => new Map(clients.map((client) => [getId(client), client])),
    [clients]
  );
  const allOrders = useMemo(() => {
    const nestedOrders = vehicles.flatMap((vehicle) => {
      const vehicleOrders = getValue(vehicle, "Pedidos");
      return (Array.isArray(vehicleOrders) ? vehicleOrders : [])
        .filter((item): item is RecordItem => typeof item === "object" && item !== null && !Array.isArray(item))
        .map((order) => ({
          ...order,
          idVeiculo:
            getValue(order, "idVeiculo", "VeiculoId") ?? getValue(vehicle, "Id"),
        }));
    });
    const byId = new Map<string, RecordItem>();
    [...nestedOrders, ...orders].forEach((order, index) => {
      const id = getId(order) || `sem-id-${index}`;
      byId.set(id, { ...(byId.get(id) ?? {}), ...order });
    });
    return [...byId.values()];
  }, [orders, vehicles]);
  const enrichedOrders = useMemo(
    () =>
      allOrders.map((order) => {
        const vehicleId = String(getValue(order, "idVeiculo", "VeiculoId") ?? "");
        const clientId = String(getValue(order, "idCliente", "ClienteId") ?? "");
        const vehicle = vehicleById.get(vehicleId);
        return {
          order,
          vehicle,
          client: clientById.get(clientId),
          status: resolveOrderStatus(order, vehicle),
        };
      }),
    [allOrders, clientById, vehicleById]
  );

  const statusCounts = Object.fromEntries(
    statusOrder.map((status) => [
      status,
      enrichedOrders.filter((item) => item.status === status).length,
    ])
  ) as Record<OrderStatus, number>;
  const openOrders = enrichedOrders.filter((item) => item.status !== "Concluída").length;
  const vehiclesInMaintenance = new Set(
    enrichedOrders
      .filter((item) => item.status !== "Concluída")
      .map((item) => String(getValue(item.order, "idVeiculo", "VeiculoId") ?? ""))
      .filter(Boolean)
  ).size;
  const awaitingApproval = statusCounts.Aguardando;
  const now = new Date();
  const monthlyRevenue = enrichedOrders.reduce((sum, item) => {
    const date = new Date(String(getValue(item.order, "DataInicio") ?? ""));
    return !Number.isNaN(date.getTime()) &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
      ? sum + toDashboardNumber(getValue(item.order, "ValorTotal"))
      : sum;
  }, 0);
  const overdue = enrichedOrders.filter((item) => {
    if (item.status === "Concluída") return false;
    const endDate = new Date(String(getValue(item.order, "DataFim") ?? ""));
    return !Number.isNaN(endDate.getTime()) && endDate < now;
  }).length;
  const attentionItems = [
    {
      value: statusCounts["Aguardando peça"],
      text: "veículo(s) aguardando peças",
      tone: "border-orange-200 bg-orange-50 text-orange-800",
    },
    {
      value: awaitingApproval,
      text: "OS aguardando aprovação do cliente",
      tone: "border-amber-200 bg-amber-50 text-amber-800",
    },
    {
      value: overdue,
      text: "veículo(s) com prazo de entrega ultrapassado",
      tone: "border-red-200 bg-red-50 text-red-800",
    },
  ].filter((item) => item.value > 0);
  const maxStatusCount = Math.max(...Object.values(statusCounts), 1);
  const latestOrders = [...enrichedOrders]
    .sort((a, b) => {
      const aDate = new Date(String(getValue(a.order, "DataInicio") ?? "")).getTime();
      const bDate = new Date(String(getValue(b.order, "DataInicio") ?? "")).getTime();
      return (Number.isNaN(bDate) ? 0 : bDate) - (Number.isNaN(aDate) ? 0 : aDate);
    })
    .slice(0, 5);

  return (
    <ProtectedRoute>
      <div className="sigo-page">
        <NavBar />
        <main className="sigo-shell sigo-dashboard-shell sigo-management-shell grid gap-7 py-8 lg:grid-cols-[310px_minmax(0,1fr)] lg:items-start">
          <DashboardSidebar />
          <div className="sigo-card sigo-dashboard-panel min-w-0 overflow-hidden bg-white">
            <header>
              <p className="text-sm font-black uppercase tracking-[0.12em] text-[var(--sigo-blue)]">Dashboard</p>
              <h1 className="mt-1 text-xl font-extrabold text-[var(--sigo-text)]">Painel da oficina</h1>
            </header>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Ordens abertas", value: openOrders, className: "border-blue-600 bg-gradient-to-br from-blue-700 to-blue-500" },
                { label: "Veículos em manutenção", value: vehiclesInMaintenance, className: "border-violet-600 bg-gradient-to-br from-violet-700 to-violet-500" },
                { label: "Aguardando aprovação", value: awaitingApproval, className: "border-amber-500 bg-gradient-to-br from-amber-500 to-yellow-400" },
                { label: "Faturamento do mês", value: moneyFormatter.format(monthlyRevenue), className: "border-emerald-600 bg-gradient-to-br from-emerald-700 to-emerald-500" },
              ].map((card) => (
                <article key={card.label} className={`rounded-[2px] border p-5 text-white shadow-[var(--sigo-shadow-sm)] ${card.className}`}>
                  <p className="text-xs font-bold text-white/85">{card.label}</p>
                  <p className="mt-2 text-2xl font-black text-white">{isLoading ? "..." : card.value}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
              <article className="sigo-card !rounded-none overflow-hidden">
                <div className="border-b border-[var(--sigo-border)] px-5 py-4">
                  <h2 className="text-base font-black text-[var(--sigo-text)]">Ordens de Serviço por status</h2>
                </div>
                <div className="grid gap-4 p-5">
                  {statusOrder.map((status) => (
                    <div key={status} className="grid gap-2">
                      <div className="flex items-center justify-between text-xs font-bold text-[var(--sigo-muted)]">
                        <span>{status}</span><span>{isLoading ? "..." : statusCounts[status]}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${chartColors[status]}`} style={{ width: `${(statusCounts[status] / maxStatusCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="sigo-card !rounded-none overflow-hidden">
                <div className="border-b border-[var(--sigo-border)] px-5 py-4">
                  <h2 className="text-base font-black text-[var(--sigo-text)]">Atenção necessária</h2>
                </div>
                <div className="grid gap-3 p-5">
                  {isLoading ? (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-600">
                      Verificando pendências...
                    </p>
                  ) : attentionItems.length > 0 ? (
                    attentionItems.map((alert) => (
                      <div key={alert.text} className={`rounded-lg border p-4 text-xs font-bold ${alert.tone}`}>
                        <span className="mr-2" aria-hidden="true">⚠️</span>
                        {alert.value} {alert.text}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-700">
                      <span className="mr-2" aria-hidden="true">✓</span>
                      Nada de ruim acontecendo. A oficina está em dia!
                    </div>
                  )}
                </div>
              </article>
            </section>

            <section className="sigo-card sigo-dashboard-orders !rounded-none overflow-hidden">
              <div className="border-b border-[var(--sigo-border)] px-5 py-4">
                <h2 className="text-base font-black text-[var(--sigo-text)]">Últimas Ordens de Serviço</h2>
              </div>
              {latestOrders.length === 0 && !isLoading ? (
                <p className="p-8 text-center text-sm font-bold text-[var(--sigo-muted)]">Nenhuma ordem de serviço encontrada.</p>
              ) : (
                <div className="sigo-scrollbar overflow-x-auto">
                  <table className="sigo-table min-w-[720px]">
                    <thead><tr><th>OS</th><th>Cliente</th><th>Veículo</th><th>Status</th><th>Data</th></tr></thead>
                    <tbody>
                      {latestOrders.map(({ order, client, vehicle, status }) => {
                        const date = new Date(String(getValue(order, "DataInicio") ?? ""));
                        return (
                          <tr key={getId(order)}>
                            <td className="font-black">#{getId(order)}</td>
                            <td>{String(getValue(client, "Nome") ?? `Cliente #${getValue(order, "idCliente") ?? "-"}`)}</td>
                            <td>{String(getValue(vehicle, "NomeVeiculo", "PlacaVeiculo") ?? `Veículo #${getValue(order, "idVeiculo") ?? "-"}`)}</td>
                            <td><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusStyles[status]}`}>{status}</span></td>
                            <td>{Number.isNaN(date.getTime()) ? "-" : dateFormatter.format(date)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
