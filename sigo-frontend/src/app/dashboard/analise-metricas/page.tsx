"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/Auth/RouteGuards";
import { DashboardSidebar } from "@/components/Dashboard/DashboardSidebar";
import { NavBar } from "@/components/Sidebar/NavBar";
import { SigoLoader } from "@/components/Loading/SigoLoader";
import { useAuth } from "@/hooks/useAuth";
import { getAllowedManagementConfigs } from "@/lib/accessControl";
import {
  fetchAllDashboardRecords,
  getDashboardValue,
  isDashboardRecord,
  toDashboardNumber,
} from "@/lib/dashboardData";
import { entityConfigs } from "@/models/entityConfigs";

type Item = Record<string, unknown>;
type Period = "today" | "7d" | "30d" | "3m" | "6m" | "1y" | "custom";
type AnalysisPanel = "overview" | "operation" | "mechanics" | "clients" | "stock";

const periods: Array<{ value: Period; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "1y", label: "1 ano" },
  { value: "custom", label: "Personalizado" },
];

const analysisPanels: Array<{ value: AnalysisPanel; label: string }> = [
  { value: "overview", label: "Visão geral" },
  { value: "operation", label: "Operação" },
  { value: "mechanics", label: "Mecânicos" },
  { value: "clients", label: "Clientes" },
  { value: "stock", label: "Estoque" },
];

const isItem = isDashboardRecord;

const getValue = (item: Item | undefined, ...keys: string[]): unknown => {
  return getDashboardValue(item, ...keys);
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR");

const getTodayIso = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getStatus = (order: Item): string => {
  const status = normalize(getValue(order, "Status", "Situacao"));
  if (["3", "concluido", "concluida", "finalizado"].includes(status)) return "Concluídas";
  if (["1", "aguardandopeca", "aguardandopecas"].includes(status)) return "Aguardando peça";
  if (["2", "emandamento", "emmanutencao"].includes(status)) return "Em andamento";
  if (["cancelado", "cancelada", "4"].includes(status)) return "Canceladas";
  return "Abertas";
};

const periodStart = (period: Period, customStart: string): Date => {
  const now = new Date();
  if (period === "custom" && customStart) return new Date(`${customStart}T00:00:00`);
  const start = new Date(now);
  if (period === "today") start.setHours(0, 0, 0, 0);
  if (period === "7d") start.setDate(now.getDate() - 6);
  if (period === "30d") start.setDate(now.getDate() - 29);
  if (period === "3m") start.setMonth(now.getMonth() - 3);
  if (period === "6m") start.setMonth(now.getMonth() - 6);
  if (period === "1y") start.setFullYear(now.getFullYear() - 1);
  return start;
};

const Ranking = ({ rows, color }: { rows: Array<[string, number]>; color: string }) => {
  const max = Math.max(...rows.map(([, value]) => value), 1);
  return (
    <div className="grid gap-4 p-5">
      {rows.length ? rows.map(([label, value]) => (
        <div key={label} className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-[var(--sigo-muted)]">
            <span className="truncate">{label}</span><span>{number.format(value)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
          </div>
        </div>
      )) : <p className="py-10 text-center text-sm font-bold text-[var(--sigo-muted)]">Sem dados no período.</p>}
    </div>
  );
};

export default function AnaliseMetricasPage() {
  const { baseUrl, token, userRole, oficinaId } = useAuth();
  const [period, setPeriod] = useState<Period>("1y");
  const [activePanel, setActivePanel] = useState<AnalysisPanel>("overview");
  const [customStart, setCustomStart] = useState(getTodayIso);
  const [customEnd, setCustomEnd] = useState(getTodayIso);
  const [records, setRecords] = useState<Record<string, Item[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const keys = new Set(["pedidos", "veiculos", "servicos", "pecas", "marcas", "funcionarios", "clientes"]);
      const configs = getAllowedManagementConfigs(entityConfigs, userRole, oficinaId)
        .filter((config) => keys.has(config.key) && config.listPath);
      const entries = await Promise.all(configs.map(async (config) => [
        config.key,
        await fetchAllDashboardRecords(baseUrl, config.listPath as string, headers),
      ] as const));
      if (mounted) setRecords(Object.fromEntries(entries));
      if (mounted) setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, [baseUrl, oficinaId, token, userRole]);

  const analysis = useMemo(() => {
    const start = periodStart(period, customStart);
    const end = period === "custom" && customEnd ? new Date(`${customEnd}T23:59:59`) : new Date();
    const vehiclesById = new Map(
      (records.veiculos ?? []).map((item) => [String(getValue(item, "Id")), item])
    );
    const nestedOrders = (records.veiculos ?? []).flatMap((vehicle) => {
      const vehicleOrders = getValue(vehicle, "Pedidos");
      return (Array.isArray(vehicleOrders) ? vehicleOrders : [])
        .filter(isItem)
        .map((order) => ({
          ...order,
          idVeiculo:
            getValue(order, "idVeiculo", "VeiculoId") ?? getValue(vehicle, "Id"),
        }));
    });
    const ordersById = new Map<string, Item>();
    [...nestedOrders, ...(records.pedidos ?? [])].forEach((order, index) => {
      const id = String(getValue(order, "Id", "id") ?? `sem-id-${index}`);
      ordersById.set(id, { ...(ordersById.get(id) ?? {}), ...order });
    });
    const orders = [...ordersById.values()].filter((order) => {
      const date = new Date(String(getValue(order, "DataInicio", "CreatedAt") ?? ""));
      return !Number.isNaN(date.getTime()) && date >= start && date <= end;
    });
    const resolveStatus = (order: Item) => getStatus(order);
    const statusLabels = ["Abertas", "Em andamento", "Aguardando peça", "Concluídas", "Canceladas"];
    const statuses = statusLabels.map((label) => [label, orders.filter((order) => resolveStatus(order) === label).length] as [string, number]);
    const completed = statuses.find(([label]) => label === "Concluídas")?.[1] ?? 0;
    const ongoing = statuses.find(([label]) => label === "Em andamento")?.[1] ?? 0;
    const revenue = orders.reduce((sum, order) => sum + toDashboardNumber(getValue(order, "ValorTotal")), 0);
    const vehicleCount = new Set(orders.map((order) => String(getValue(order, "idVeiculo", "VeiculoId") ?? "")).filter(Boolean)).size;

    const services = new Map<string, number>();
    const pieces = new Map<string, number>();
    let usedPieces = 0;
    orders.forEach((order) => {
      const serviceLines = getValue(order, "Pedido_Servicos", "PedidoServicos");
      (Array.isArray(serviceLines) ? serviceLines : []).forEach((line) => {
        if (!isItem(line)) return;
        const id = String(getValue(line, "IdServico") ?? "");
        const catalog = (records.servicos ?? []).find((item) => String(getValue(item, "Id")) === id);
        const label = String(getValue(catalog, "Nome") ?? `Serviço #${id}`);
        services.set(label, (services.get(label) ?? 0) + Math.max(0, toDashboardNumber(getValue(line, "QuantVezes"))));
      });
      const pieceLines = getValue(order, "Pedido_Pecas", "PedidoPecas");
      (Array.isArray(pieceLines) ? pieceLines : []).forEach((line) => {
        if (!isItem(line)) return;
        const id = String(getValue(line, "IdPeca") ?? "");
        const catalog = (records.pecas ?? []).find((item) => String(getValue(item, "Id")) === id);
        const label = String(getValue(catalog, "Nome") ?? `Peça #${id}`);
        const quantity = Math.max(0, toDashboardNumber(getValue(line, "Quantidade")));
        usedPieces += quantity;
        pieces.set(label, (pieces.get(label) ?? 0) + quantity);
      });
    });

    const models = new Map<string, number>();
    orders.forEach((order) => {
      const vehicle = vehiclesById.get(String(getValue(order, "idVeiculo", "VeiculoId") ?? ""));
      const label = String(
        getValue(vehicle, "ModeloVeiculo", "Modelo", "modeloVeiculo", "modelo") ??
          "Não informado"
      );
      models.set(label, (models.get(label) ?? 0) + 1);
    });

    const durations = orders.map((order) => {
      const initial = new Date(String(getValue(order, "DataInicio") ?? "")).getTime();
      const final = new Date(String(getValue(order, "DataFim") ?? "")).getTime();
      return Number.isNaN(initial) || Number.isNaN(final) || final < initial ? 0 : final - initial;
    }).filter(Boolean);
    const averageMs = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
    const averageDays = Math.floor(averageMs / 86400000);
    const averageHours = Math.floor((averageMs % 86400000) / 3600000);

    const mechanicMap = new Map<string, { name: string; services: number; completed: number; duration: number; durationCount: number; revenue: number; orders: number }>();
    orders.forEach((order) => {
      const employeeId = String(getValue(order, "idFuncionario", "FuncionarioId") ?? "");
      if (!employeeId) return;
      const employee = (records.funcionarios ?? []).find((item) => String(getValue(item, "Id")) === employeeId);
      const current = mechanicMap.get(employeeId) ?? {
        name: String(getValue(employee, "Nome") ?? `Funcionário #${employeeId}`),
        services: 0, completed: 0, duration: 0, durationCount: 0, revenue: 0, orders: 0,
      };
      const lines = getValue(order, "Pedido_Servicos", "PedidoServicos");
      current.services += (Array.isArray(lines) ? lines : []).reduce(
        (sum, line) => sum + (isItem(line) ? Math.max(0, toDashboardNumber(getValue(line, "QuantVezes"))) : 0), 0
      );
      current.completed += resolveStatus(order) === "Concluídas" ? 1 : 0;
      current.revenue += toDashboardNumber(getValue(order, "ValorTotal"));
      current.orders += 1;
      const initial = new Date(String(getValue(order, "DataInicio") ?? "")).getTime();
      const final = new Date(String(getValue(order, "DataFim") ?? "")).getTime();
      if (!Number.isNaN(initial) && !Number.isNaN(final) && final >= initial) {
        current.duration += final - initial;
        current.durationCount += 1;
      }
      mechanicMap.set(employeeId, current);
    });

    const monthlyDurationMap = new Map<string, { label: string; total: number; count: number }>();
    orders.forEach((order) => {
      if (resolveStatus(order) !== "Concluídas") return;
      const initial = new Date(String(getValue(order, "DataInicio") ?? ""));
      const final = new Date(String(getValue(order, "DataFim") ?? ""));
      if (Number.isNaN(initial.getTime()) || Number.isNaN(final.getTime()) || final < initial) return;
      const key = `${initial.getFullYear()}-${String(initial.getMonth() + 1).padStart(2, "0")}`;
      const current = monthlyDurationMap.get(key) ?? {
        label: initial.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""),
        total: 0, count: 0,
      };
      current.total += (final.getTime() - initial.getTime()) / 86400000;
      current.count += 1;
      monthlyDurationMap.set(key, current);
    });

    const clientOrders = new Map<string, Item[]>();
    orders.forEach((order) => {
      const id = String(getValue(order, "idCliente", "ClienteId") ?? "");
      if (id) clientOrders.set(id, [...(clientOrders.get(id) ?? []), order]);
    });
    const newClients = (records.clientes ?? []).filter((client) => {
      const date = new Date(String(getValue(client, "CreatedAt", "DataCadastro", "DataCriacao") ?? ""));
      return !Number.isNaN(date.getTime()) && date >= start && date <= end;
    }).length;
    const recurringClients = [...clientOrders.values()].filter((clientItems) => clientItems.length > 1).length;
    const inactiveClients = (records.clientes ?? []).filter((client) => {
      const status = normalize(getValue(client, "Situacao", "Status"));
      return ["2", "inativo", "inactive", "blocked"].includes(status);
    }).length;
    const vehiclesPerClient = (records.clientes ?? []).length
      ? (records.veiculos ?? []).length / records.clientes.length
      : 0;
    const returnIntervals: number[] = [];
    clientOrders.forEach((clientItems) => {
      const dates = clientItems.map((order) => new Date(String(getValue(order, "DataInicio") ?? "")).getTime()).filter((date) => !Number.isNaN(date)).sort((a, b) => a - b);
      for (let index = 1; index < dates.length; index += 1) returnIntervals.push((dates[index] - dates[index - 1]) / 86400000);
    });
    const averageReturn = returnIntervals.length
      ? returnIntervals.reduce((sum, value) => sum + value, 0) / returnIntervals.length
      : 0;

    const usedPieceIds = new Set<string>();
    orders.forEach((order) => {
      const lines = getValue(order, "Pedido_Pecas", "PedidoPecas");
      (Array.isArray(lines) ? lines : []).forEach((line) => {
        if (isItem(line)) usedPieceIds.add(String(getValue(line, "IdPeca") ?? ""));
      });
    });
    const getPieceQuantity = (piece: Item) => {
      const unit = Math.max(1, Math.floor(toDashboardNumber(getValue(piece, "Unidade"))));
      const stock = getValue(piece, "quantidadeEstoque", "Quantidade_Estoque");
      return stock === undefined
        ? Math.floor(toDashboardNumber(getValue(piece, "Quantidade")))
        : Math.floor(toDashboardNumber(stock) / unit);
    };
    const lowStock = (records.pecas ?? []).filter((piece) => {
      return getPieceQuantity(piece) <= 5;
    }).length;
    const stockValue = (records.pecas ?? []).reduce(
      (sum, piece) => sum + toDashboardNumber(getValue(piece, "Valor")) * getPieceQuantity(piece), 0
    );
    const stockEntries = (records.pecas ?? []).reduce((sum, piece) => {
      const date = new Date(String(getValue(piece, "DataAquisicao") ?? ""));
      return !Number.isNaN(date.getTime()) && date >= start && date <= end
        ? sum + getPieceQuantity(piece) : sum;
    }, 0);
    const withoutMovement = (records.pecas ?? []).filter(
      (piece) => !usedPieceIds.has(String(getValue(piece, "Id") ?? ""))
    ).length;

    const bucketCount = period === "today" || period === "7d" ? 7 : 6;
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = new Date(start.getTime() + ((end.getTime() - start.getTime()) / bucketCount) * index);
      const bucketEnd = new Date(start.getTime() + ((end.getTime() - start.getTime()) / bucketCount) * (index + 1));
      const value = orders.reduce((sum, order) => {
        const date = new Date(String(getValue(order, "DataInicio") ?? ""));
        return date >= bucketStart && date < bucketEnd ? sum + toDashboardNumber(getValue(order, "ValorTotal")) : sum;
      }, 0);
      return { label: bucketStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""), value };
    });

    const rank = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      orders, statuses, completed, ongoing, revenue, vehicleCount, usedPieces,
      services: rank(services), pieces: rank(pieces), models: rank(models), buckets,
      average: `${averageDays}d ${averageHours}h`,
      mechanics: [...mechanicMap.values()].sort((a, b) => b.orders - a.orders),
      monthlyDurations: [...monthlyDurationMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([, value]) => ({ label: value.label, value: value.total / value.count })),
      clients: { newClients, recurringClients, inactiveClients, vehiclesPerClient, averageReturn },
      stock: { lowStock, stockValue, entries: stockEntries, exits: usedPieces, withoutMovement },
    };
  }, [customEnd, customStart, period, records]);

  const maxRevenue = Math.max(...analysis.buckets.map((item) => item.value), 1);
  const points = analysis.buckets.map((item, index) =>
    `${3 + (index / Math.max(analysis.buckets.length - 1, 1)) * 94},${88 - (item.value / maxRevenue) * 70}`
  ).join(" ");
  const cards = [
    ["Ordens de serviço", analysis.orders.length, "from-blue-700 to-blue-500"],
    ["Serviços concluídos", analysis.completed, "from-emerald-700 to-emerald-500"],
    ["Serviços em andamento", analysis.ongoing, "from-amber-500 to-yellow-400"],
    ["Veículos atendidos", analysis.vehicleCount, "from-violet-700 to-violet-500"],
    ["Faturamento", money.format(analysis.revenue), "from-cyan-700 to-cyan-500"],
    ["Ticket médio", money.format(analysis.orders.length ? analysis.revenue / analysis.orders.length : 0), "from-indigo-700 to-indigo-500"],
    ["Peças utilizadas", analysis.usedPieces, "from-rose-700 to-rose-500"],
    ["Tempo médio de serviço", analysis.average, "from-slate-700 to-slate-500"],
  ];
  const maxDuration = Math.max(...analysis.monthlyDurations.map((item) => item.value), 1);
  const clientCards = [
    ["Novos clientes", analysis.clients.newClients, "border-blue-200 bg-blue-50 text-blue-800"],
    ["Clientes recorrentes", analysis.clients.recurringClients, "border-emerald-200 bg-emerald-50 text-emerald-800"],
    ["Clientes inativos", analysis.clients.inactiveClients, "border-rose-200 bg-rose-50 text-rose-800"],
    ["Veículos por cliente", analysis.clients.vehiclesPerClient.toFixed(1), "border-violet-200 bg-violet-50 text-violet-800"],
    ["Frequência média de retorno", `${analysis.clients.averageReturn.toFixed(1)} dias`, "border-amber-200 bg-amber-50 text-amber-800"],
  ];
  const stockCards = [
    ["Peças mais utilizadas", analysis.usedPieces, "border-orange-200 bg-orange-50 text-orange-800"],
    ["Peças com estoque baixo", analysis.stock.lowStock, "border-red-200 bg-red-50 text-red-800"],
    ["Valor total do estoque", money.format(analysis.stock.stockValue), "border-emerald-200 bg-emerald-50 text-emerald-800"],
    ["Entradas de peças", analysis.stock.entries, "border-blue-200 bg-blue-50 text-blue-800"],
    ["Saídas de peças", analysis.stock.exits, "border-violet-200 bg-violet-50 text-violet-800"],
    ["Peças sem movimentação", analysis.stock.withoutMovement, "border-slate-200 bg-slate-50 text-slate-800"],
  ];

  return (
    <ProtectedRoute allowedRoles={["oficina"]}>
      <div className="sigo-page">
        <NavBar />
        <main className="sigo-shell sigo-dashboard-shell sigo-management-shell grid gap-7 py-8 lg:grid-cols-[310px_minmax(0,1fr)] lg:items-start">
          <DashboardSidebar />
          <div className="sigo-card sigo-dashboard-panel sigo-analysis-panel min-w-0 overflow-hidden bg-white">
            <header>
              <p className="text-sm font-black uppercase tracking-[0.12em] text-[var(--sigo-blue)]">Análise</p>
              <h1 className="mt-1 text-xl font-extrabold text-[var(--sigo-text)]">Estatísticas da oficina</h1>
            </header>

            <section className="border-b border-[var(--sigo-border)] p-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--sigo-muted)]">Período</p>
              <div className="flex flex-wrap gap-2">
                {periods.map((option) => <button key={option.value} type="button" onClick={() => setPeriod(option.value)} className={`sigo-button min-h-9 px-4 py-2 text-xs ${period === option.value ? "sigo-button-primary" : "bg-white"}`}>{option.label}</button>)}
              </div>
              {period === "custom" ? <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2"><label className="sigo-label"><span>Data inicial</span><input className="sigo-input" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><label className="sigo-label"><span>Data final</span><input className="sigo-input" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></div> : null}
            </section>

            <nav className="sigo-analysis-tabs p-5" aria-label="Painéis de análise">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--sigo-muted)]">Selecionar painel</p>
              <div className="flex flex-wrap gap-2">
                {analysisPanels.map((panel) => (
                  <button key={panel.value} type="button" onClick={() => setActivePanel(panel.value)} className={`sigo-button min-h-10 px-5 py-2 text-xs ${activePanel === panel.value ? "sigo-button-primary" : "bg-white"}`}>
                    {panel.label}
                  </button>
                ))}
              </div>
            </nav>

            <div className="sigo-analysis-content">
            {loading ? <div className="flex min-h-96 items-center justify-center"><SigoLoader compact /></div> : <>
              {activePanel === "overview" ? <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {cards.map(([label, value, tone]) => <article key={String(label)} className={`rounded-[2px] bg-gradient-to-br ${tone} p-5 text-white shadow-[var(--sigo-shadow-sm)]`}><p className="text-xs font-bold text-white/85">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></article>)}
              </section>

              <section className="sigo-card !mt-5 !rounded-none overflow-hidden" style={{ marginTop: "1.25rem" }}>
                <div className="border-b border-[var(--sigo-border)] px-5 py-4"><h2 className="text-base font-black">Faturamento ao longo do tempo</h2><p className="mt-1 text-xs font-medium text-[var(--sigo-muted)]">Evolução do faturamento da oficina no período selecionado.</p></div>
                <div className="p-5">
                  <div className="relative h-72 w-full overflow-hidden border-b border-l border-[var(--sigo-border)] bg-white">
                    <div className="absolute inset-x-0 top-1/4 border-t border-dashed border-slate-200" />
                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200" />
                    <div className="absolute inset-x-0 top-3/4 border-t border-dashed border-slate-200" />
                    <svg className="absolute inset-0 block h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs><linearGradient id="revenueArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2563eb" stopOpacity=".3"/><stop offset="1" stopColor="#2563eb" stopOpacity="0"/></linearGradient></defs>
                      <polygon points={`3,92 ${points} 97,92`} fill="url(#revenueArea)" />
                      <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                  <div
                    className="mt-3 grid w-full items-start text-center text-[10px] font-bold text-[var(--sigo-muted)]"
                    style={{ gridTemplateColumns: `repeat(${analysis.buckets.length}, minmax(0, 1fr))` }}
                  >
                    {analysis.buckets.map((item, index) => (
                      <span key={`${item.label}-${index}`} className="whitespace-nowrap px-1">{item.label}</span>
                    ))}
                  </div>
                </div>
              </section>
              </> : null}

              {activePanel === "operation" ? <>
              <section className="grid gap-5 xl:grid-cols-2">
                <article className="sigo-card !rounded-none overflow-hidden"><div className="border-b border-[var(--sigo-border)] px-5 py-4"><h2 className="text-base font-black">Ordens de serviço por status</h2></div><Ranking rows={analysis.statuses} color="bg-gradient-to-r from-blue-600 to-cyan-400" /></article>
                <article className="sigo-card !rounded-none overflow-hidden"><div className="border-b border-[var(--sigo-border)] px-5 py-4"><h2 className="text-base font-black">Serviços mais realizados</h2></div><Ranking rows={analysis.services} color="bg-gradient-to-r from-violet-600 to-fuchsia-400" /></article>
                <article className="sigo-card !rounded-none overflow-hidden"><div className="border-b border-[var(--sigo-border)] px-5 py-4"><h2 className="text-base font-black">Peças mais utilizadas</h2></div><Ranking rows={analysis.pieces} color="bg-gradient-to-r from-amber-500 to-orange-400" /></article>
                <article className="sigo-card !rounded-none overflow-hidden"><div className="border-b border-[var(--sigo-border)] px-5 py-4"><h2 className="text-base font-black">Veículos atendidos por modelo</h2></div><Ranking rows={analysis.models} color="bg-gradient-to-r from-emerald-600 to-teal-400" /></article>
              </section>

              <section className="sigo-card !rounded-none overflow-hidden">
                <div className="border-b border-[var(--sigo-border)] px-5 py-4"><h2 className="text-base font-black">Tempo médio das ordens de serviço</h2><p className="mt-1 text-xs font-medium text-[var(--sigo-muted)]">Evolução mensal do tempo necessário para concluir uma OS.</p></div>
                <div className="grid min-h-72 grid-cols-6 items-end gap-3 p-5">
                  {analysis.monthlyDurations.length ? analysis.monthlyDurations.map((item) => <div key={item.label} className="flex h-full min-w-0 flex-col items-center justify-end gap-2"><span className="text-xs font-black text-[var(--sigo-muted)]">{item.value.toFixed(1)}d</span><div className="w-full max-w-20 rounded-t-sm bg-gradient-to-t from-indigo-700 to-violet-400" style={{ height: `${Math.max(8, (item.value / maxDuration) * 82)}%` }} /><span className="text-[10px] font-bold uppercase text-[var(--sigo-muted)]">{item.label}</span></div>) : <p className="col-span-6 self-center text-center text-sm font-bold text-[var(--sigo-muted)]">Sem ordens concluídas no período.</p>}
                </div>
              </section>
              </> : null}

              {activePanel === "mechanics" ? (
              <section className="sigo-card !rounded-none overflow-hidden">
                <div className="border-b border-[var(--sigo-border)] px-5 py-4"><h2 className="text-base font-black">Desempenho dos mecânicos</h2><p className="mt-1 text-xs font-medium text-[var(--sigo-muted)]">Produtividade dos responsáveis pelas ordens de serviço.</p></div>
                {analysis.mechanics.length ? <div className="sigo-scrollbar overflow-x-auto"><table className="sigo-table min-w-[820px]"><thead><tr><th>Mecânico</th><th>Serviços realizados</th><th>Serviços concluídos</th><th>Tempo médio</th><th>Valor gerado</th><th>Quantidade de OS</th></tr></thead><tbody>{analysis.mechanics.map((mechanic) => {
                  const average = mechanic.durationCount ? mechanic.duration / mechanic.durationCount : 0;
                  const days = Math.floor(average / 86400000);
                  const hours = Math.floor((average % 86400000) / 3600000);
                  return <tr key={mechanic.name}><td className="font-black">{mechanic.name}</td><td>{mechanic.services}</td><td>{mechanic.completed}</td><td>{days}d {hours}h</td><td className="font-bold text-emerald-700">{money.format(mechanic.revenue)}</td><td>{mechanic.orders}</td></tr>;
                })}</tbody></table></div> : <p className="p-10 text-center text-sm font-bold text-[var(--sigo-muted)]">Nenhum funcionário responsável encontrado no período.</p>}
              </section>
              ) : null}

              {activePanel === "clients" ? <section className="sigo-card !rounded-none overflow-hidden"><div className="border-b border-[var(--sigo-border)] px-5 py-4"><h2 className="text-base font-black">Clientes</h2></div><div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">{clientCards.map(([label, value, tone]) => <div key={String(label)} className={`rounded-sm border p-4 ${tone}`}><p className="text-xs font-bold opacity-80">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>)}</div></section> : null}

              {activePanel === "stock" ? <section className="sigo-card !rounded-none overflow-hidden"><div className="border-b border-[var(--sigo-border)] px-5 py-4"><h2 className="text-base font-black">Estoque</h2></div><div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">{stockCards.map(([label, value, tone]) => <div key={String(label)} className={`rounded-sm border p-4 ${tone}`}><p className="text-xs font-bold opacity-80">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>)}</div></section> : null}
            </>}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
