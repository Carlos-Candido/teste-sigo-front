"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/navigation/routes";

const tabs = [
  { label: "Dashboard", href: routes.dashboard },
  { label: "Gerencia", href: routes.management },
  { label: "Analise e Metricas", href: routes.analytics },
  { label: "Perfil", href: routes.profile },
];

export function DashboardTabs() {
  const pathname = usePathname();

  return (
    <section className="flex justify-center">
      <div className="inline-flex flex-wrap justify-center gap-2 rounded-lg border border-[var(--sigo-border)] bg-white/55 p-2 backdrop-blur-sm">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex min-h-9 items-center justify-center rounded-lg border px-4 text-sm font-black ${
                isActive
                  ? "border-[var(--sigo-blue)] bg-transparent text-[var(--sigo-blue)]"
                  : "border-[var(--sigo-border)] bg-transparent text-[var(--sigo-blue-deep)] hover:bg-white/70"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
