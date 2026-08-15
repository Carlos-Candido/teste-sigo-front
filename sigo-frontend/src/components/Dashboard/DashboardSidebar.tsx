"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/navigation/routes";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRole } from "@/lib/accessControl";

const managementItems = [
  { key: "clientes", label: "Clientes", icon: "/do-utilizador.png" },
  { key: "veiculos", label: "Veículos", icon: "/carro.png" },
  { key: "funcionarios", label: "Funcionários", icon: "/engenheiro.png" },
  { key: "marcas", label: "Marcas", icon: "/forma-de-etiqueta-preta.png" },
  { key: "servicos", label: "Serviços", icon: "/chave-e-chave-de-fenda-cruzadas.png" },
  { key: "pecas", label: "Estoque", icon: "/carro%20(1).png" },
  { key: "pedidos", label: "Ordem de serviço (Pedido)", icon: "/prancheta.png" },
];

const employeeManagementKeys = ["clientes", "veiculos", "servicos", "pecas", "pedidos"];

type DashboardSidebarProps = {
  activeEntity?: string;
  availableEntities?: string[];
  onEntitySelect?: (key: string) => void;
};

const itemClass = (active: boolean) =>
  `relative flex min-h-13 w-full items-center justify-center rounded-md border px-12 py-3 text-center text-sm font-black transition-colors ${
    active
      ? "border-white bg-white/10 text-white shadow-[0_6px_16px_rgba(0,0,0,0.18)]"
      : "border-transparent bg-transparent text-white hover:bg-white/10"
  }`;

const iconClass = () =>
  "absolute left-4 h-6 w-6 object-contain brightness-0 invert";

const SidebarIcon = ({ src }: { src: string }) => (
  <img src={src} alt="" aria-hidden="true" className={iconClass()} />
);

export function DashboardSidebar({ activeEntity, availableEntities, onEntitySelect }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { userRole } = useAuth();
  const isOffice = normalizeRole(userRole) === "oficina";
  const isEmployee = normalizeRole(userRole) === "funcionario";
  const visibleManagementItems = managementItems.filter((item) => {
    if (isEmployee && !employeeManagementKeys.includes(item.key)) return false;
    return !availableEntities || availableEntities.includes(item.key);
  });

  return (
    <aside className="sigo-dashboard-sidebar self-stretch">
      <nav className="sigo-dashboard-sidebar-nav grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-1" aria-label={isEmployee ? "Navegação do funcionário" : "Navegação da oficina"}>
        {!isEmployee ? (
          <Link className={itemClass(pathname === routes.dashboard)} href={routes.dashboard}>
            <SidebarIcon src="/casa.png" />
            <span>Dashboard</span>
          </Link>
        ) : null}
        {visibleManagementItems.map((item) => {
          const active = pathname === routes.management && activeEntity === item.key;
          return (
            <Link
              key={item.key}
              className={itemClass(active)}
              href={`${routes.management}?entidade=${item.key}`}
              onClick={() => onEntitySelect?.(item.key)}
            >
              <SidebarIcon src={item.icon} />
              <span>{isEmployee ? ({ clientes: "Cliente", veiculos: "Veículo", servicos: "Serviços", pecas: "Estoque", pedidos: "Ordem de Pedido" } as Record<string, string>)[item.key] ?? item.label : item.label}</span>
            </Link>
          );
        })}
        {!isEmployee ? (
          <Link className={itemClass(pathname === routes.analytics)} href={routes.analytics}>
            <SidebarIcon src="/elevacao.png" />
            <span>Análise</span>
          </Link>
        ) : null}
        {isOffice ? (
          <Link className={itemClass(pathname === routes.audit)} href={routes.audit}>
            <SidebarIcon src="/red-eyes.png" />
            <span>Auditoria</span>
          </Link>
        ) : null}
        <Link className={itemClass(pathname === routes.profile)} href={routes.profile}>
          <SidebarIcon src="/lista-telefonica.png" />
          <span>Perfil</span>
        </Link>
      </nav>
    </aside>
  );
}
