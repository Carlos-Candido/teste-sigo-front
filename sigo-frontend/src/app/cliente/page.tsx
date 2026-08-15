"use client";

import { useEffect, useMemo, useState } from "react";
import { NavBar } from "@/components/Sidebar/NavBar";
import { ProtectedRoute } from "@/components/Auth/RouteGuards";
import { SigoLoader } from "@/components/Loading/SigoLoader";
import { useMinimumLoading } from "@/hooks/useMinimumLoading";
import { useAuth } from "@/hooks/useAuth";
import { fetchJson } from "@/lib/api";

type RecordValue = Record<string, unknown>;
type ClientTab = "vehicles" | "history";

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extractList = (data: unknown): RecordValue[] => {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (!isRecord(data)) return [];
  const candidates = [
    data.items, data.Items, data.data, data.Data, data.result, data.Result,
    data.pedidos, data.Pedidos, data.historico, data.Historico,
    data.ordensServico, data.OrdensServico,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
    if (isRecord(candidate)) {
      const nested = extractList(candidate);
      if (nested.length) return nested;
    }
  }
  return [];
};

const getValue = (record: RecordValue | undefined, ...keys: string[]): any => {
  if (!record) return undefined;
  const entries = Object.entries(record).map(([key, value]) => [
    key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase(),
    value,
  ] as const);
  for (const key of keys) {
    if (key in record) return record[key];
    const normalized = key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const found = entries.find(([candidate]) => candidate === normalized);
    if (found) return found[1];
  }
  return undefined;
};

const getId = (record: RecordValue): number | null => {
  const id = Number(getValue(record, "Id", "id", "ID"));
  return Number.isFinite(id) && id > 0 ? id : null;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatMoney = (value: unknown) => money.format(Number(value) || 0);
const formatDate = (value: unknown) => {
  if (!value) return "-";
  const text = String(value);
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString("pt-BR");
};

const fieldLabels: Record<string, string> = {
  id: "ID", idpedido: "Pedido", idpeca: "Peça", idservico: "Serviço",
  idcliente: "Cliente", idfuncionario: "Funcionário", idveiculo: "Veículo",
  idmarca: "Marca", idoficina: "Oficina", quantidade: "Quantidade",
  quantvezes: "Quantidade de vezes", datainstalacao: "Data de instalação",
  datainicio: "Data de início", datafim: "Data de término", valortotal: "Valor total",
  observacao: "Observação", estado: "Estado", status: "Status",
};
const normalizeKey = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
const formatFieldLabel = (key: string) => fieldLabels[normalizeKey(key)] ?? key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
const relationByField: Record<string, string> = {
  idpeca: "pecas",
  idservico: "servicos",
  idcliente: "clientes",
  idfuncionario: "funcionarios",
  idveiculo: "veiculos",
  idmarca: "marcas",
};

const relationNameFields: Record<string, string[]> = {
  idpeca: ["NomePeca", "PecaNome", "Nome"],
  idservico: ["NomeServico", "ServicoNome", "Nome"],
  idcliente: ["NomeCliente", "ClienteNome", "Nome"],
  idfuncionario: ["NomeFuncionario", "FuncionarioNome", "Nome"],
  idveiculo: ["NomeVeiculo", "VeiculoNome", "ModeloVeiculo", "Modelo", "PlacaVeiculo", "Placa"],
  idmarca: ["NomeMarca", "MarcaNome", "Nome"],
};

const relationObjectFields: Record<string, string[]> = {
  idpeca: ["Peca", "Peça"],
  idservico: ["Servico", "Serviço"],
  idcliente: ["Cliente"],
  idfuncionario: ["Funcionario", "Funcionário"],
  idveiculo: ["Veiculo", "Veículo"],
  idmarca: ["Marca"],
};

const getRelationNameFromSource = (key: string, source?: RecordValue): string | null => {
  if (!source) return null;
  const normalized = normalizeKey(key);

  for (const field of relationNameFields[normalized] ?? []) {
    const candidate = getValue(source, field);
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  for (const field of relationObjectFields[normalized] ?? []) {
    const candidate = getValue(source, field);
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (isRecord(candidate)) {
      for (const nameField of relationNameFields[normalized] ?? ["Nome"]) {
        const name = getValue(candidate, nameField);
        if (typeof name === "string" && name.trim()) return name.trim();
      }
    }
  }

  return null;
};

const resolveDisplayValue = (
  key: string,
  value: unknown,
  catalogs: Record<string, RecordValue[]>,
  source?: RecordValue
): string => {
  const normalized = normalizeKey(key);
  if (normalized === "status") {
    const statuses: Record<string, string> = {
      "0": "Pendente",
      "1": "Aguardando peças",
      "2": "Em andamento",
      "3": "Concluído",
    };
    return statuses[String(value ?? "")] ?? String(value ?? "-");
  }

  const relation = relationByField[normalized];
  if (relation) {
    const embeddedName = getRelationNameFromSource(key, source);
    if (embeddedName) return embeddedName;

    const record = (catalogs[relation] ?? []).find(
      (item) => String(getId(item)) === String(value)
    );
    if (record) {
      const catalogName = getRelationNameFromSource(key, record);
      if (catalogName) return catalogName;
    }

    return "Não informado";
  }
  if (normalized.startsWith("data")) return formatDate(value);
  return String(value ?? "-");
};

function VehicleDetailsModal({ vehicle, images, catalogs, onClose }: { vehicle: RecordValue; images: string[]; catalogs: Record<string, RecordValue[]>; onClose: () => void }) {
  const fields: Array<[string, unknown]> = [
    ["Nome", getValue(vehicle, "NomeVeiculo", "Nome")], ["Modelo", getValue(vehicle, "ModeloVeiculo", "Modelo")],
    ["Placa", getValue(vehicle, "PlacaVeiculo")], ["Chassi", getValue(vehicle, "ChassiVeiculo")],
    ["Ano de fabricação", getValue(vehicle, "AnoFab")], ["Quilometragem", getValue(vehicle, "Quilometragem")],
    ["Combustível", getValue(vehicle, "Combustivel")], ["Seguro", getValue(vehicle, "Seguro")],
    ["Cor", getValue(vehicle, "Cor")],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="sigo-card flex max-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col overflow-hidden bg-white">
        <header className="flex shrink-0 items-center justify-between bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] px-5 py-4 text-white"><h2 className="text-xl font-black text-white">Ver veículo</h2><button type="button" className="text-2xl font-black" onClick={onClose} aria-label="Fechar">×</button></header>
        <div className="sigo-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          <div className="rounded-lg border border-[var(--sigo-border)] bg-white p-4">
            <div className="grid gap-4 md:grid-cols-2">{fields.map(([label, value]) => <label key={label} className="rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-3"><span className="mb-2 block text-xs font-bold text-[var(--sigo-muted)]">{label}</span><input className="sigo-input bg-white" value={String(value ?? "-")} readOnly /></label>)}</div>
            <div className="mt-4 overflow-hidden rounded-lg border border-[var(--sigo-border)] bg-white shadow-[var(--sigo-shadow-sm)]">
              <div className="border-b border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] px-4 py-3">
                <p className="text-sm font-black text-[var(--sigo-text)]">Imagens</p>
                <p className="mt-1 text-xs font-medium text-[var(--sigo-muted)]">Imagens vinculadas ao veículo.</p>
              </div>
              <div className="grid gap-3 p-4">
                {images.length ? <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{images.map((image, index) => <figure key={image} className="relative overflow-hidden rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)]"><img src={image} alt={`Imagem ${index + 1} do veículo`} className="aspect-video w-full object-cover" /><figcaption className="truncate px-3 py-2 text-xs font-semibold text-[var(--sigo-muted)]">Imagem {index + 1}</figcaption></figure>)}</div> : <p className="mb-4 rounded-lg border border-dashed border-[var(--sigo-border-strong)] bg-[var(--sigo-surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--sigo-muted)]">Nenhuma imagem salva.</p>}
              </div>
            </div>
          </div>
        </div>
        <footer className="flex shrink-0 justify-end border-t border-[var(--sigo-border)] bg-white p-4"><button type="button" className="sigo-button" onClick={onClose}>Fechar</button></footer>
      </div>
    </div>
  );
}

function OrderDetailsModal({ order, catalogs, onClose }: { order: RecordValue; catalogs: Record<string, RecordValue[]>; onClose: () => void }) {
  const fields: Array<[string, unknown]> = [
    ["Cliente", resolveDisplayValue("idCliente", getValue(order, "idCliente", "ClienteId"), catalogs, order)],
    ["Funcionário", resolveDisplayValue("idFuncionario", getValue(order, "idFuncionario", "FuncionarioId"), catalogs, order)],
    ["Veículo", resolveDisplayValue("idVeiculo", getValue(order, "idVeiculo", "VeiculoId", "__vehicleId"), catalogs, order)],
    ["Data de início", formatDate(getValue(order, "DataInicio"))],
    ["Data de término", formatDate(getValue(order, "DataFim"))],
    ["Status", resolveDisplayValue("Status", getValue(order, "Status", "Situacao"), catalogs)],
    ["Valor total", formatMoney(getValue(order, "ValorTotal"))],
    ["Observação", getValue(order, "Observacao")],
  ];
  const groups: Array<[string, unknown]> = [
    ["Peças", getValue(order, "Pedido_Pecas", "PedidoPecas")],
    ["Serviços", getValue(order, "Pedido_Servicos", "PedidoServicos")],
  ];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="sigo-card flex max-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col overflow-hidden bg-white"><header className="flex shrink-0 items-center justify-between bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] px-5 py-4 text-white"><h2 className="text-xl font-black text-white">Ver Pedido #{getId(order) ?? ""}</h2><button type="button" className="text-2xl font-black" onClick={onClose} aria-label="Fechar">×</button></header><div className="sigo-scrollbar min-h-0 flex-1 overflow-y-auto p-4"><div className="rounded-lg border border-[var(--sigo-border)] bg-white p-4"><div className="grid gap-4 md:grid-cols-2">{fields.map(([label, value]) => <label key={label} className="rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-3"><span className="mb-2 block text-xs font-bold text-[var(--sigo-muted)]">{label}</span><input className="sigo-input bg-white" value={String(value ?? "-")} readOnly /></label>)}</div>{groups.map(([label, value]) => { const items = Array.isArray(value) ? value.filter(isRecord) : []; return <section key={label} className="mt-4 overflow-hidden rounded-lg border border-[var(--sigo-border)] bg-white shadow-[var(--sigo-shadow-sm)]"><header className="border-b border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] px-4 py-3"><p className="text-sm font-black text-[var(--sigo-text)]">{label}</p></header><div className="grid gap-3 p-4">{items.length ? items.map((item, index) => <div key={`${label}-${index}`} className="grid gap-3 rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-4 sm:grid-cols-2">{Object.entries(item).filter(([, itemValue]) => !isRecord(itemValue) && !Array.isArray(itemValue)).map(([key, itemValue]) => <label key={key}><span className="mb-1 block text-xs font-bold text-[var(--sigo-muted)]">{formatFieldLabel(key)}</span><input className="sigo-input bg-white" value={resolveDisplayValue(key, itemValue, catalogs, item)} readOnly /></label>)}</div>) : <p className="text-sm font-semibold text-[var(--sigo-muted)]">Nenhum item registrado.</p>}</div></section>; })}</div></div><footer className="flex shrink-0 justify-end border-t border-[var(--sigo-border)] bg-white p-4"><button type="button" className="sigo-button" onClick={onClose}>Fechar</button></footer></div></div>;
}

export default function ClientePage() {
  const { baseUrl, token, fullName, userName } = useAuth();
  const [activeTab, setActiveTab] = useState<ClientTab>("vehicles");
  const [vehicles, setVehicles] = useState<RecordValue[]>([]);
  const [orders, setOrders] = useState<RecordValue[]>([]);
  const [catalogs, setCatalogs] = useState<Record<string, RecordValue[]>>({});
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [viewingVehicle, setViewingVehicle] = useState<RecordValue | null>(null);
  const [viewingVehicleImages, setViewingVehicleImages] = useState<string[]>([]);
  const [viewingOrder, setViewingOrder] = useState<RecordValue | null>(null);
  const [downloadChoice, setDownloadChoice] = useState<{ vehicleId: number; orderId: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isVisible: showLoading, cycle: loadingCycle } = useMinimumLoading(isLoading, 500);

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      const result = await fetchJson(baseUrl, "/api/v1/veiculos", {
        method: "GET",
        headers: authHeaders,
      });
      if (!mounted) return;
      if (!result.ok) {
        setError("Não foi possível carregar seus veículos.");
        setVehicles([]);
      } else {
        const nextVehicles = extractList(result.data);
        setVehicles(nextVehicles);
        setSelectedVehicleId(getId(nextVehicles[0] ?? {}) ?? null);
      }
      setIsLoading(false);
    };
    if (token) void load();
    return () => { mounted = false; };
  }, [authHeaders, baseUrl, token]);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    const loadCatalogs = async () => {
      const keys = ["clientes", "funcionarios", "veiculos", "pecas", "servicos", "marcas"];
      const entries = await Promise.all(keys.map(async (key) => {
        const result = await fetchJson(baseUrl, `/api/v1/${key}`, { method: "GET", headers: authHeaders });
        return [key, result.ok ? extractList(result.data) : []] as const;
      }));
      if (mounted) setCatalogs(Object.fromEntries(entries));
    };
    void loadCatalogs();
    return () => { mounted = false; };
  }, [authHeaders, baseUrl, token]);

  useEffect(() => {
    if (activeTab !== "history" || vehicles.length === 0) return;
    let mounted = true;
    const loadHistory = async () => {
      setIsLoading(true);
      setError(null);
      const [reportResults, ordersResult] = await Promise.all([
        Promise.all(vehicles.map(async (vehicle) => {
        const vehicleId = getId(vehicle);
        if (!vehicleId) return [];
        const result = await fetchJson(baseUrl, `/api/v1/relatorios/veiculos/${vehicleId}/historico`, { method: "GET", headers: authHeaders });
        return result.ok ? extractList(result.data).map((order) => ({ ...order, __vehicleId: vehicleId })) : [];
        })),
        fetchJson(baseUrl, "/api/v1/pedidos", { method: "GET", headers: authHeaders }),
      ]);
      if (!mounted) return;
      const vehicleIds = new Set(vehicles.map(getId).filter(Boolean).map(String));
      const regularOrders = ordersResult.ok ? extractList(ordersResult.data).filter((order) =>
        vehicleIds.has(String(getValue(order, "idVeiculo", "IdVeiculo", "VeiculoId") ?? ""))
      ) : [];
      const merged = new Map<string, RecordValue>();
      [...reportResults.flat(), ...regularOrders].forEach((order, index) => {
        const id = getId(order);
        const vehicleId = getValue(order, "__vehicleId", "idVeiculo", "IdVeiculo", "VeiculoId");
        merged.set(String(id ?? `${vehicleId}-${index}`), { ...order, __vehicleId: vehicleId });
      });
      setOrders([...merged.values()]);
      setIsLoading(false);
    };
    void loadHistory();
    return () => { mounted = false; };
  }, [activeTab, authHeaders, baseUrl, vehicles]);

  useEffect(() => {
    if (!viewingVehicle) { setViewingVehicleImages([]); return; }
    let mounted = true;
    const objectUrls: string[] = [];
    const loadImages = async () => {
      const vehicleId = getId(viewingVehicle);
      let source = viewingVehicle;
      if (vehicleId) {
        const detail = await fetchJson(baseUrl, `/api/v1/veiculos/${vehicleId}`, { method: "GET", headers: authHeaders });
        if (isRecord(detail.data)) source = isRecord(detail.data.data) ? detail.data.data : isRecord(detail.data.Data) ? detail.data.Data : detail.data;
      }
      const images = getValue(source, "Imagens", "imagens");
      const paths = (Array.isArray(images) ? images.filter(isRecord) : []).map((image) => String(getValue(image, "Url", "Caminho") ?? "")).filter(Boolean);
      const urls = await Promise.all(paths.map(async (path) => {
        const url = path.startsWith("http") ? path : `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
        try { const response = await fetch(url, { headers: authHeaders }); if (!response.ok) return null; const objectUrl = URL.createObjectURL(await response.blob()); objectUrls.push(objectUrl); return objectUrl; } catch { return null; }
      }));
      if (mounted) setViewingVehicleImages(urls.filter(Boolean) as string[]);
    };
    void loadImages();
    return () => { mounted = false; objectUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [authHeaders, baseUrl, viewingVehicle]);

  const viewingOrderId = viewingOrder ? getId(viewingOrder) : null;
  useEffect(() => {
    if (!viewingOrderId) return;
    let mounted = true;
    const loadOrderDetails = async () => {
      const result = await fetchJson(baseUrl, `/api/v1/pedidos/${viewingOrderId}`, { method: "GET", headers: authHeaders });
      if (!mounted || !result.ok || !isRecord(result.data)) return;
      const detail = isRecord(result.data.data) ? result.data.data : isRecord(result.data.Data) ? result.data.Data : result.data;
      setViewingOrder((current) => current ? { ...current, ...detail } : detail);
    };
    void loadOrderDetails();
    return () => { mounted = false; };
  }, [authHeaders, baseUrl, viewingOrderId]);

  const downloadReport = async (vehicleId: number, format: "pdf" | "excel") => {
    setReportLoading(vehicleId);
    setError(null);
    try {
      const response = await fetch(
        `${baseUrl.replace(/\/$/, "")}/api/v1/relatorios/veiculos/${vehicleId}${format === "excel" ? "/excel" : ""}`,
        { headers: authHeaders }
      );
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pedido-${downloadChoice?.orderId ?? vehicleId}.${format === "excel" ? "xlsx" : "pdf"}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("Não foi possível gerar o relatório deste veículo.");
    } finally {
      setReportLoading(null);
      setDownloadChoice(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["cliente"]}>
      <div className="sigo-page sigo-client-area">
        <NavBar />
        <main className="sigo-shell grid !max-w-3xl gap-5 py-8">
          <section className="sigo-card overflow-hidden bg-white">
            <header className="border-b border-[var(--sigo-border)] px-6 py-5">
              <p className="text-sm font-black uppercase tracking-[0.12em] text-[var(--sigo-blue)]">Área do cliente</p>
              <h1 className="mt-1 text-xl font-extrabold text-[var(--sigo-text)]">Olá, {fullName || userName || "cliente"}</h1>
            </header>
            <nav className="border-b border-[var(--sigo-border)] p-5" aria-label="Área do cliente">
              <div className="relative isolate mx-auto flex w-full flex-nowrap overflow-hidden rounded-xl border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-1 sm:max-w-2xl">
                <span aria-hidden="true" className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-lg shadow-[var(--sigo-shadow-sm)] transition-transform duration-300 ease-in-out" style={{ zIndex: 1, width: "calc(50% - 0.25rem)", transform: activeTab === "vehicles" ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)", background: activeTab === "vehicles" ? "linear-gradient(135deg, #0b3f79, #1769bd)" : "linear-gradient(135deg, #047857, #10b981)" }} />
                <button type="button" className="relative flex min-h-12 min-w-0 flex-1 basis-1/2 items-center justify-center gap-2 border-0 bg-transparent !text-base font-black shadow-none transition-colors duration-300" style={{ zIndex: 2, color: activeTab === "vehicles" ? "#ffffff" : "var(--sigo-blue-deep)" }} onClick={() => setActiveTab("vehicles")}><img src="/carro.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain transition-[filter] duration-300" style={{ filter: activeTab === "vehicles" ? "brightness(0) invert(1)" : "none" }} /><span>Veículos</span></button>
                <button type="button" className="relative flex min-h-12 min-w-0 flex-1 basis-1/2 items-center justify-center gap-2 border-0 bg-transparent !text-base font-black shadow-none transition-colors duration-300" style={{ zIndex: 2, color: activeTab === "history" ? "#ffffff" : "#047857" }} onClick={() => setActiveTab("history")}><span>Histórico</span><img src="/hist%C3%B3rico.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain transition-[filter] duration-300" style={{ filter: activeTab === "history" ? "brightness(0) invert(1)" : "none" }} /></button>
              </div>
            </nav>

            {error ? <div className="sigo-error m-5 px-4 py-3 text-sm font-semibold">{error}</div> : null}
            {showLoading ? <div className="flex min-h-96 items-center justify-center"><SigoLoader key={loadingCycle} compact /></div> : null}

            {!showLoading && activeTab === "vehicles" ? (
              <section key="client-vehicles" className="sigo-client-tab-from-left grid w-full gap-3 p-5">
                {vehicles.length ? vehicles.map((vehicle, index) => { const id = getId(vehicle); return <article key={id ?? index} className="w-full rounded-xl border border-[var(--sigo-border)] bg-white p-5 shadow-[var(--sigo-shadow-sm)]"><div className="flex items-start justify-between gap-4"><div><p className="text-lg font-black text-[var(--sigo-blue-deep)]">{String(getValue(vehicle, "NomeVeiculo", "Nome") ?? "Veículo")}</p><p className="mt-1 text-sm font-bold text-[var(--sigo-muted)]">{String(getValue(vehicle, "ModeloVeiculo", "Modelo") ?? "Modelo não informado")} · {String(getValue(vehicle, "AnoFab") ?? "-")}</p></div><span className="sigo-badge text-sm">{String(getValue(vehicle, "PlacaVeiculo") ?? "Sem placa")}</span></div><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" className="sigo-button min-h-11 text-sm" onClick={() => setViewingVehicle(vehicle)}>Ver dados</button><button type="button" className="sigo-button sigo-button-primary min-h-11 text-sm" onClick={() => { setSelectedVehicleId(id); setActiveTab("history"); }}>Ver histórico</button></div></article>; }) : <p className="py-16 text-center font-bold text-[var(--sigo-muted)]">Nenhum veículo encontrado.</p>}
              </section>
            ) : null}

            {!showLoading && activeTab === "history" ? (
              <section key="client-history" className="sigo-client-tab-from-right grid w-full gap-3 p-5">
                {orders.length ? orders.map((order, index) => { const id = getId(order) ?? index + 1; const vehicleId = Number(getValue(order, "__vehicleId", "idVeiculo", "VeiculoId")); return <article key={`pedido-${vehicleId}-${id}`} className="w-full rounded-xl border border-[var(--sigo-border)] bg-white p-5 shadow-[var(--sigo-shadow-sm)]"><div className="flex items-start justify-between gap-4"><div><p className="text-lg font-black text-emerald-700">Pedido #{id}</p><p className="mt-1 text-sm font-bold text-[var(--sigo-muted)]">{formatDate(getValue(order, "DataInicio"))} até {formatDate(getValue(order, "DataFim"))}</p></div><span className="text-lg font-black text-emerald-600">{formatMoney(getValue(order, "ValorTotal"))}</span></div><div className="mt-5 flex items-center justify-between"><button type="button" className="sigo-button min-h-11 border-emerald-600 px-4 text-sm !text-emerald-700 hover:!bg-emerald-50" onClick={() => setViewingOrder(order)}>Ver pedido</button><button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50" disabled={!vehicleId || reportLoading === vehicleId} onClick={() => vehicleId && setDownloadChoice({ vehicleId, orderId: id })} title="Baixar relatório" aria-label="Baixar relatório"><svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg></button></div></article>; }) : <p className="col-span-full py-16 text-center font-bold text-[var(--sigo-muted)]">Nenhum pedido encontrado.</p>}
              </section>
            ) : null}
          </section>
        </main>

        {downloadChoice ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4"><div className="sigo-card w-full max-w-sm overflow-hidden bg-white"><header className="flex items-center justify-between bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] px-5 py-4 text-white"><h2 className="text-lg font-black text-white">Baixar pedido #{downloadChoice.orderId}</h2><button type="button" className="text-2xl font-black" onClick={() => setDownloadChoice(null)} aria-label="Fechar">×</button></header><div className="grid grid-cols-2 gap-3 p-5"><button type="button" className="sigo-button min-h-12" style={{ backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }} disabled={reportLoading === downloadChoice.vehicleId} onClick={() => void downloadReport(downloadChoice.vehicleId, "pdf")}><img src="/pdf.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain brightness-0 invert" /><span className="text-white">PDF</span></button><button type="button" className="sigo-button min-h-12 bg-white" style={{ backgroundColor: "#ffffff", borderColor: "#059669", color: "#059669" }} disabled={reportLoading === downloadChoice.vehicleId} onClick={() => void downloadReport(downloadChoice.vehicleId, "excel")}><span style={{ color: "#059669" }}>Excel</span><img src="/excel.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain" style={{ filter: "brightness(0) saturate(100%) invert(39%) sepia(95%) saturate(576%) hue-rotate(112deg) brightness(91%) contrast(101%)" }} /></button></div></div></div> : null}

        {viewingVehicle ? <VehicleDetailsModal vehicle={viewingVehicle} images={viewingVehicleImages} catalogs={catalogs} onClose={() => setViewingVehicle(null)} /> : null}
        {viewingOrder ? <OrderDetailsModal order={viewingOrder} catalogs={catalogs} onClose={() => setViewingOrder(null)} /> : null}
      </div>
    </ProtectedRoute>
  );
}
