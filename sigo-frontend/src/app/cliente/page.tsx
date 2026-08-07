"use client";

import { useEffect, useMemo, useState } from "react";
import { NavBar } from "@/components/Sidebar/NavBar";
import { ProtectedRoute } from "@/components/Auth/RouteGuards";
import { useAuth } from "@/hooks/useAuth";
import { fetchJson } from "@/lib/api";

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extractList = (data: unknown): RecordValue[] => {
  if (Array.isArray(data)) return data as RecordValue[];
  if (isRecord(data)) {
    const nested = data.data ?? data.Data ?? data.items ?? data.result;
    if (Array.isArray(nested)) return nested as RecordValue[];
    if (isRecord(nested) && Array.isArray(nested.items)) {
      return nested.items as RecordValue[];
    }
  }
  return [];
};

const getValue = (record: RecordValue, keys: string[]): unknown => {
  const normalizedEntries = Object.entries(record).map(([key, value]) => [
    key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase(),
    value,
  ]);

  for (const key of keys) {
    if (key in record) return record[key];
    const normalized = key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const found = normalizedEntries.find(([candidate]) => candidate === normalized);
    if (found) return found[1];
  }

  return undefined;
};

const getId = (record: RecordValue): number | null => {
  const id = Number(getValue(record, ["Id", "id", "ID"]));
  return Number.isFinite(id) && id > 0 ? id : null;
};

const formatMoney = (value: unknown): string => {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(number);
};

const formatDate = (value: unknown): string => {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR").format(date);
};

const buildInfoCards = (
  vehiclesCount: number,
  ordersCount: number,
  selectedOrdersCount: number
) => [
  { label: "Veiculos", value: String(vehiclesCount) },
  { label: "Historicos", value: String(ordersCount) },
  { label: "Selecionado", value: String(selectedOrdersCount) },
];

export default function ClientePage() {
  const { baseUrl, token, fullName, userName } = useAuth();
  const [vehicles, setVehicles] = useState<RecordValue[]>([]);
  const [orders, setOrders] = useState<RecordValue[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  useEffect(() => {
    let isMounted = true;

    const loadClientData = async () => {
      setIsLoading(true);
      setError(null);

      const [vehiclesResult, ordersResult] = await Promise.all([
        fetchJson(baseUrl, "/api/v1/veiculos", {
          method: "GET",
          headers: authHeaders,
        }),
        fetchJson(baseUrl, "/api/v1/pedidos", {
          method: "GET",
          headers: authHeaders,
        }),
      ]);

      if (!isMounted) return;

      if (!vehiclesResult.ok) {
        setError("Não foi possível carregar seus veículos.");
        setVehicles([]);
        setOrders([]);
        setIsLoading(false);
        return;
      }

      const nextVehicles = extractList(vehiclesResult.data);
      setVehicles(nextVehicles);
      setOrders(ordersResult.ok ? extractList(ordersResult.data) : []);
      setSelectedVehicleId(getId(nextVehicles[0] ?? {}) ?? null);
      setIsLoading(false);
    };

    if (token) loadClientData();

    return () => {
      isMounted = false;
    };
  }, [authHeaders, baseUrl, token]);

  const selectedVehicle = vehicles.find((vehicle) => getId(vehicle) === selectedVehicleId);
  const selectedOrders = orders.filter((order) => {
    const vehicleId = Number(getValue(order, ["idVeiculo", "IdVeiculo", "VeiculoId"]));
    return selectedVehicleId !== null && vehicleId === selectedVehicleId;
  });

  return (
    <ProtectedRoute>
      <div className="sigo-page">
        <NavBar />
        <main className="mx-auto grid w-full max-w-md gap-5 px-4 py-5 sm:max-w-2xl">
          <section className="rounded-2xl bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] p-5 text-white shadow-[var(--sigo-shadow-md)]">
            <p className="text-sm font-bold text-blue-100">Área do cliente</p>
            <h1 className="mt-2 text-2xl font-black text-white">
              Olá, {fullName || userName || "cliente"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-blue-50">
              Acompanhe seus veículos e seus históricos.
            </p>
          </section>

          <section className="grid grid-cols-3 gap-2">
            {buildInfoCards(vehicles.length, orders.length, selectedOrders.length).map(
              (card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-[var(--sigo-border)] bg-white/80 p-3 text-center shadow-[var(--sigo-shadow-sm)]"
                >
                  <p className="text-xl font-black text-[var(--sigo-blue-deep)]">
                    {card.value}
                  </p>
                  <p className="mt-1 text-[0.7rem] font-bold uppercase text-[var(--sigo-muted)]">
                    {card.label}
                  </p>
                </div>
              )
            )}
          </section>

          {error ? (
            <div className="sigo-error px-4 py-3 text-sm font-semibold">
              {error}
            </div>
          ) : null}

          <section className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-[var(--sigo-text)]">
                Meus veículos
              </h2>
              <span className="sigo-badge">{vehicles.length}</span>
            </div>

            {isLoading ? (
              <div className="sigo-card p-5 text-sm font-semibold text-[var(--sigo-muted)]">
                Carregando...
              </div>
            ) : vehicles.length === 0 ? (
              <div className="sigo-card p-5 text-sm font-semibold text-[var(--sigo-muted)]">
                Nenhum veículo encontrado.
              </div>
            ) : (
              <div className="grid gap-3">
                {vehicles.map((vehicle) => {
                  const id = getId(vehicle);
                  const name =
                    getValue(vehicle, ["NomeVeiculo", "nomeVeiculo", "Nome"]) ??
                    "Veiculo";
                  const plate = getValue(vehicle, ["PlacaVeiculo", "placaVeiculo"]);
                  const model = getValue(vehicle, ["TipoVeiculo", "tipoVeiculo"]);
                  const isActive = id === selectedVehicleId;

                  return (
                    <button
                      key={id ?? String(name)}
                      type="button"
                      className={`rounded-xl border p-4 text-left shadow-[var(--sigo-shadow-sm)] ${
                        isActive
                          ? "border-[var(--sigo-blue)] bg-[var(--sigo-blue-soft)]"
                          : "border-[var(--sigo-border)] bg-white"
                      }`}
                      onClick={() => setSelectedVehicleId(id)}
                    >
                      <p className="text-base font-black text-[var(--sigo-blue-deep)]">
                        {String(name)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="sigo-badge">{String(plate ?? "Sem placa")}</span>
                        <span className="sigo-badge">{String(model ?? "Veiculo")}</span>
                      </div>
                      <span
                        className={`mt-4 inline-flex min-h-9 items-center justify-center rounded-lg border px-3 text-xs font-black ${
                          isActive
                            ? "border-[var(--sigo-blue)] bg-white text-[var(--sigo-blue)]"
                            : "border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] text-[var(--sigo-blue-deep)]"
                        }`}
                      >
                        Ver histórico
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-[var(--sigo-text)]">
                Histórico
              </h2>
              <span className="sigo-badge">{selectedOrders.length}</span>
            </div>

            {selectedVehicle ? (
              <p className="text-sm font-semibold text-[var(--sigo-muted)]">
                {String(getValue(selectedVehicle, ["NomeVeiculo", "Nome"]) ?? "Veiculo selecionado")}
              </p>
            ) : null}

            {selectedOrders.length === 0 ? (
              <div className="sigo-card p-5 text-sm font-semibold text-[var(--sigo-muted)]">
                Nenhuma alteração registrada para este veículo.
              </div>
            ) : (
              <div className="grid gap-3">
                {selectedOrders.map((order, index) => {
                  const id = getId(order) ?? index + 1;
                  const start = getValue(order, ["DataInicio", "dataInicio"]);
                  const end = getValue(order, ["DataFim", "dataFim"]);
                  const total = getValue(order, ["ValorTotal", "valorTotal"]);
                  const note = getValue(order, ["Observacao", "observacao"]);

                  return (
                    <article
                      key={`pedido-${id}`}
                      className="relative rounded-xl border border-[var(--sigo-border)] bg-white p-4 shadow-[var(--sigo-shadow-sm)]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[var(--sigo-blue)] shadow-[0_0_0_4px_var(--sigo-blue-soft)]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-[var(--sigo-text)]">
                                Alteração #{id}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-[var(--sigo-muted)]">
                                {formatDate(start)} até {formatDate(end)}
                              </p>
                            </div>
                            <span className="text-sm font-black text-[var(--sigo-blue)]">
                              {formatMoney(total)}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-[var(--sigo-muted)]">
                            {String(note || "Serviço registrado pela oficina.")}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
                <button
                  type="button"
                  className="sigo-button w-full"
                  onClick={(event) => event.preventDefault()}
                >
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="M7 10l5 5 5-5" />
                    <path d="M12 15V3" />
                  </svg>
                  Baixar relatório
                </button>
              </div>
            )}
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
