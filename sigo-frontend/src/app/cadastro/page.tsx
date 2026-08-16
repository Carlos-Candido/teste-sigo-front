"use client";

import Link from "next/link";
import { AuthPageLayout } from "@/components/Auth/AuthPageLayout";
import { PublicOnlyRoute } from "@/components/Auth/RouteGuards";
import { ProfileTypeIcon, profileTypeInfo } from "@/components/Profile/ProfileTypeIcon";
import { routes } from "@/navigation/routes";

const accountChoices = [
  { role: "cliente" as const, href: routes.registerCliente, action: "Criar conta de cliente" },
  { role: "oficina" as const, href: routes.registerOficina, action: "Cadastrar oficina" },
];

export default function CadastroPage() {
  return (
    <PublicOnlyRoute>
      <AuthPageLayout
        eyebrow="Novo cadastro"
        title="Como você quer usar o SIGO?"
        description="Escolha Cliente ou Oficina. Contas de funcionário são criadas e gerenciadas pela própria oficina."
      >
        <div className="grid gap-4 p-6 sm:p-8">
          {accountChoices.map((choice) => {
            const info = profileTypeInfo[choice.role];
            return (
              <Link
                key={choice.role}
                href={choice.href}
                className="group grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--sigo-blue)] hover:shadow-[var(--sigo-shadow-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sigo-blue)] motion-reduce:transform-none"
                aria-label={choice.action}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--sigo-blue)] p-2 text-white shadow-sm">
                  <ProfileTypeIcon role={choice.role} />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-black text-[var(--sigo-text)]">{info.label}</span>
                  <span className="mt-1 block text-sm leading-5 text-[var(--sigo-muted)]">{info.description}</span>
                </span>
                <svg aria-hidden="true" className="h-5 w-5 text-[var(--sigo-blue)] transition-transform group-hover:translate-x-1 motion-reduce:transform-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            );
          })}

          <div className="mt-2 border-t border-[var(--sigo-border)] pt-5 text-center text-sm text-[var(--sigo-muted)]">
            Já tem uma conta?{" "}
            <Link className="font-black text-[var(--sigo-blue)] hover:text-[var(--sigo-blue-dark)]" href={routes.login}>
              Voltar para o login
            </Link>
          </div>
        </div>
      </AuthPageLayout>
    </PublicOnlyRoute>
  );
}
