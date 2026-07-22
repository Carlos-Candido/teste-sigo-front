"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchJson } from "@/lib/api";
import { getAllowedManagementConfigs, normalizeRole } from "@/lib/accessControl";
import { entityConfigs } from "@/models/entityConfigs";
import { routes } from "@/navigation/routes";
import { NavBar } from "@/components/Sidebar/NavBar";
import { ProtectedRoute } from "@/components/Auth/RouteGuards";
import { DashboardTabs } from "@/components/Dashboard/DashboardTabs";

type Metric = {
  key: string;
  label: string;
  count: number;
  available: boolean;
};

const dashboardKeys = [
  "clientes",
  "funcionarios",
  "veiculos",
  "pedidos",
  "pecas",
  "servicos",
];

const extractList = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const nested = record.data ?? record.items ?? record.result;
    if (Array.isArray(nested)) return nested;
    if (nested && typeof nested === "object") {
      const nestedRecord = nested as Record<string, unknown>;
      if (Array.isArray(nestedRecord.items)) return nestedRecord.items;
    }
  }
  return [];
};

export default function DashboardPage() {
  const router = useRouter();
  const { baseUrl, token, userRole, oficinaId } = useAuth();
  const configs = useMemo(
    () =>
      getAllowedManagementConfigs(
        entityConfigs.filter((config) => dashboardKeys.includes(config.key)),
        userRole,
        oficinaId
      ),
    [oficinaId, userRole]
  );
  const [metrics, setMetrics] = useState<Metric[]>(
    configs.map((config) => ({
      key: config.key,
      label: config.label,
      count: 0,
      available: false,
    }))
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (normalizeRole(userRole) === "cliente") {
      router.replace(routes.clientHome);
    }
  }, [router, userRole]);

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      setIsLoading(true);
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

      const nextMetrics = await Promise.all(
        configs.map(async (config) => {
          if (!config.listPath) {
            return {
              key: config.key,
              label: config.label,
              count: 0,
              available: false,
            };
          }

          const result = await fetchJson(baseUrl, config.listPath, {
            method: "GET",
            headers: authHeaders,
          });

          if (!result.ok) {
            return {
              key: config.key,
              label: config.label,
              count: 0,
              available: false,
            };
          }

          return {
            key: config.key,
            label: config.label,
            count: extractList(result.data).length,
            available: true,
          };
        })
      );

      if (!isMounted) return;
      setMetrics(nextMetrics);
      setIsLoading(false);
    };

    loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [baseUrl, configs, token]);

  const total = metrics.reduce((sum, metric) => sum + metric.count, 0);
  const maxCount = Math.max(...metrics.map((metric) => metric.count), 1);
  const activeSources = metrics.filter((metric) => metric.available).length;
  const pedidos = metrics.find((metric) => metric.key === "pedidos")?.count ?? 0;
  const veiculos = metrics.find((metric) => metric.key === "veiculos")?.count ?? 0;

  return (
    <ProtectedRoute>
      <div className="sigo-page">
      <NavBar />
      <main className="sigo-shell grid gap-6 py-8">
        <DashboardTabs />

        <section className="sigo-card overflow-hidden">
          <div className="grid gap-6 bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] p-6 text-white lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-100">
              Visão Geral
              </p>
              <h1 className="mt-3 text-3xl font-black text-white lg:text-4xl">
                Bem-Vindo
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50">
                Acompanhe os princípais números do sistema e acesse a área de
                gerência para cadastrar e atualizar registros.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="sigo-card p-5">
            <p className="text-sm font-bold text-[var(--sigo-muted)]">
              Registros mapeados
            </p>
            <p className="mt-3 text-3xl font-black text-[var(--sigo-blue-deep)]">
              {isLoading ? "..." : total}
            </p>
          </div>
          <div className="sigo-card p-5">
            <p className="text-sm font-bold text-[var(--sigo-muted)]">
              Fontes ativas
            </p>
            <p className="mt-3 text-3xl font-black text-[var(--sigo-blue-deep)]">
              {isLoading ? "..." : `${activeSources}/${metrics.length}`}
            </p>
          </div>
          <div className="sigo-card p-5">
            <p className="text-sm font-bold text-[var(--sigo-muted)]">
              Pedidos
            </p>
            <p className="mt-3 text-3xl font-black text-[var(--sigo-blue-deep)]">
              {isLoading ? "..." : pedidos}
            </p>
          </div>
          <div className="sigo-card p-5">
            <p className="text-sm font-bold text-[var(--sigo-muted)]">
              Veículos
            </p>
            <p className="mt-3 text-3xl font-black text-[var(--sigo-blue-deep)]">
              {isLoading ? "..." : veiculos}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="sigo-card overflow-hidden">
            <div className="border-b border-[var(--sigo-border)] bg-white px-5 py-4">
              <p className="mt-1 text-sm text-[var(--sigo-muted)]">
                Comparativos
              </p>
            </div>
            <div className="grid gap-4 p-5">
              {metrics.map((metric) => {
                const width = `${Math.max(6, (metric.count / maxCount) * 100)}%`;
                return (
                  <div key={metric.key} className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-[var(--sigo-text)]">
                        {metric.label}
                      </span>
                      <span className="text-sm font-black text-[var(--sigo-blue-deep)]">
                        {metric.available ? metric.count : "Indisponivel"}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-[var(--sigo-blue-soft)]">
                      <div
                        className="h-full rounded-full bg-[var(--sigo-blue)]"
                        style={{ width: metric.available ? width : "0%" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sigo-card overflow-hidden">
            <div className="border-b border-[var(--sigo-border)] bg-white px-5 py-4">
              <h2 className="text-base font-extrabold text-[var(--sigo-text)]">
                Distribuição operacional
              </h2>
              <p className="mt-1 text-sm text-[var(--sigo-muted)]">
                Leitura rápida para acompanhamento.
              </p>
            </div>
            <div className="grid gap-4 p-5">
              {metrics.slice(0, 5).map((metric) => {
                const percent = total > 0 ? Math.round((metric.count / total) * 100) : 0;
                return (
                  <div
                    key={`share-${metric.key}`}
                    className="rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-[var(--sigo-text)]">
                        {metric.label}
                      </p>
                      <p className="text-sm font-black text-[var(--sigo-blue)]">
                        {metric.available ? `${percent}%` : "--"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      </div>
    </ProtectedRoute>
  );
}
