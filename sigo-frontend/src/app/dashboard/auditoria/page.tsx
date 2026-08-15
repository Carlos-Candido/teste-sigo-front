"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/Auth/RouteGuards";
import { DashboardSidebar } from "@/components/Dashboard/DashboardSidebar";
import { SigoLoader } from "@/components/Loading/SigoLoader";
import { NavBar } from "@/components/Sidebar/NavBar";
import { useAuth } from "@/hooks/useAuth";
import { fetchJson } from "@/lib/api";

type AuditRecord = Record<string, unknown>;

const PAGE_SIZE = 10;

const isRecord = (value: unknown): value is AuditRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extractList = (payload: unknown): AuditRecord[] => {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const value of [
    payload.items,
    payload.Items,
    payload.data,
    payload.Data,
    payload.result,
    payload.Result,
    payload.auditorias,
    payload.Auditorias,
  ]) {
    if (Array.isArray(value)) return value.filter(isRecord);
    if (isRecord(value)) {
      const nested = extractList(value);
      if (nested.length) return nested;
    }
  }
  return [];
};

const normalizeKey = (value: string) =>
  value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const getValue = (record: AuditRecord | undefined, ...keys: string[]) => {
  if (!record) return undefined;
  const entries = Object.entries(record);
  for (const key of keys) {
    const normalized = normalizeKey(key);
    const match = entries.find(([candidate]) => normalizeKey(candidate) === normalized);
    if (match) return match[1];
  }
  return undefined;
};

const getId = (record: AuditRecord) =>
  Number(getValue(record, "Id", "FuncionarioId", "IdFuncionario")) || 0;

const labels: Record<string, string> = {
  id: "ID",
  funcionarioid: "Funcionário",
  idfuncionario: "Funcionário",
  nomefuncionario: "Funcionário",
  acao: "Ação",
  evento: "Evento",
  entidade: "Entidade",
  recurso: "Recurso",
  registroid: "Registro",
  entidadeid: "Registro",
  datahora: "Data e hora",
  criadoem: "Data e hora",
  data: "Data",
  detalhes: "Detalhes",
  descricao: "Descrição",
  ip: "IP",
};

const formatLabel = (key: string) =>
  labels[normalizeKey(key)] ??
  key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());

const formatDateTime = (value: unknown) => {
  const text = String(value ?? "");
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text || "-" : date.toLocaleString("pt-BR");
};

export default function AuditoriaPage() {
  const { baseUrl, token } = useAuth();
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [employees, setEmployees] = useState<AuditRecord[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  const load = async (selectedEmployee = employeeId) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const auditPath = selectedEmployee
      ? `/api/v1/auditoria-funcionarios/funcionario/${selectedEmployee}`
      : "/api/v1/auditoria-funcionarios";
    const [auditResult, employeeResult] = await Promise.all([
      fetchJson(baseUrl, auditPath, { method: "GET", headers: authHeaders }),
      fetchJson(baseUrl, "/api/v1/funcionarios", { method: "GET", headers: authHeaders }),
    ]);
    setRecords(auditResult.ok ? extractList(auditResult.data) : []);
    setEmployees(employeeResult.ok ? extractList(employeeResult.data) : []);
    if (!auditResult.ok) setError("Não foi possível carregar os registros de auditoria.");
    setLoading(false);
  };

  useEffect(() => {
    void load(employeeId);
  }, [authHeaders, baseUrl, employeeId, token]);

  useEffect(() => setPage(1), [employeeId, search]);

  const employeeName = (id: unknown) => {
    const employee = employees.find((item) => String(getId(item)) === String(id));
    return String(getValue(employee, "Nome") ?? `Funcionário #${id}`);
  };

  const filtered = records.filter((record) =>
    !search.trim() ||
    Object.entries(record).some(([key, value]) => {
      const displayed = ["funcionarioid", "idfuncionario"].includes(normalizeKey(key))
        ? employeeName(value)
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value ?? "");
      return `${formatLabel(key)} ${displayed}`.toLowerCase().includes(search.trim().toLowerCase());
    })
  );

  const columns = useMemo(() => {
    const keys = records.flatMap((record) =>
      Object.entries(record)
        .filter(([, value]) => !Array.isArray(value) && !isRecord(value))
        .map(([key]) => key)
    );
    return [...new Map(keys.map((key) => [normalizeKey(key), key])).values()].slice(0, 7);
  }, [records]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const displayValue = (record: AuditRecord, key: string) => {
    const value = getValue(record, key);
    const normalized = normalizeKey(key);
    if (["funcionarioid", "idfuncionario"].includes(normalized)) return employeeName(value);
    if (normalized.includes("data") || normalized.includes("hora") || normalized.includes("criadoem")) {
      return formatDateTime(value);
    }
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    return String(value ?? "-");
  };

  return (
    <ProtectedRoute allowedRoles={["oficina"]}>
      <div className="sigo-page">
        <NavBar />
        <main className="sigo-shell sigo-dashboard-shell sigo-management-shell grid gap-7 py-8 lg:grid-cols-[310px_minmax(0,1fr)] lg:items-start">
          <DashboardSidebar />
          <section className="sigo-card min-w-0 overflow-hidden">
            <header className="border-b border-[var(--sigo-border)] bg-white p-5">
              <p className="text-sm font-black uppercase tracking-[0.12em] text-[var(--sigo-blue)]">Auditoria</p>
              <h1 className="mt-1 text-xl font-extrabold text-[var(--sigo-text)]">Atividades dos funcionários</h1>
            </header>

            <div className="grid gap-4 p-5">
              {error ? <div className="sigo-error px-4 py-3 text-sm font-semibold">{error}</div> : null}
              <div className="grid gap-3 rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-3 md:grid-cols-[minmax(0,1fr)_18rem_auto] md:items-end">
                <label className="sigo-label">
                  <span>Pesquisar auditoria</span>
                  <input className="sigo-input bg-white" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar ação, entidade ou detalhe" />
                </label>
                <label className="sigo-label">
                  <span>Funcionário</span>
                  <select className="sigo-input bg-white" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                    <option value="">Todos os funcionários</option>
                    {employees.map((employee) => {
                      const id = getId(employee);
                      return <option key={id} value={id}>{String(getValue(employee, "Nome") ?? `Funcionário #${id}`)}</option>;
                    })}
                  </select>
                </label>
                <button type="button" className="sigo-button min-h-[46px] bg-white" onClick={() => void load(employeeId)}>Atualizar</button>
              </div>

              <div className="h-[27.5rem] overflow-hidden">
                {loading ? (
                  <div className="flex h-full items-center justify-center"><SigoLoader compact /></div>
                ) : visibleRecords.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[var(--sigo-border-strong)] bg-[var(--sigo-surface-soft)] p-8 text-sm font-bold text-[var(--sigo-muted)]">Nenhum registro de auditoria encontrado.</div>
                ) : (
                  <div className="sigo-scrollbar h-full overflow-auto rounded-lg border border-[var(--sigo-border)]">
                    <table className="sigo-table min-w-full">
                      <thead><tr>{columns.map((key) => <th key={key}>{formatLabel(key)}</th>)}</tr></thead>
                      <tbody>
                        {visibleRecords.map((record, index) => (
                          <tr key={String(getValue(record, "Id") ?? `${currentPage}-${index}`)} className="h-11">
                            {columns.map((key) => <td key={key} className="max-w-72 truncate" title={displayValue(record, key)}>{displayValue(record, key)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <footer className="flex min-h-[3.75rem] flex-col gap-3 rounded-lg border border-[var(--sigo-border)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[var(--sigo-muted)]">Mostrando {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} registro(s)</p>
                <div className="flex items-center gap-2">
                  <button type="button" className="sigo-button min-h-9 px-3 text-xs" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button>
                  <span className="sigo-badge">Página {currentPage} de {totalPages}</span>
                  <button type="button" className="sigo-button min-h-9 px-3 text-xs" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Próxima</button>
                </div>
              </footer>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}